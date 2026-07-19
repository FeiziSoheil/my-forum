import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { saveFile } from "@/lib/fileHandler";
import { isChatThemeId } from "@/lib/chat/themes";
import {
  clampWallpaperBlur,
  clampWallpaperDim,
} from "@/lib/chat/wallpaper";
import { createNotification } from "@/lib/notifications/createNotification";
import { ConversationModel } from "@/models/Conversation";
import { NotificationModel } from "@/models/Notification";
import { ThemeProposalModel } from "@/models/ThemeProposal";
import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/conversations/[id]/theme/propose
 * Direct: create/replace pending ThemeProposal + notify peer.
 * Group (admin): apply sharedTheme immediately for everyone.
 *
 * Body: multipart FormData
 *  - themeId, blur, dim
 *  - wallpaper? (image file)
 *  - clearWallpaper? ("1") when removing prior wallpaper on re-share
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;
    const { id: conversationId } = await params;

    const conv = await ConversationModel.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 }
      );
    }

    const form = await req.formData();
    const themeIdRaw = String(form.get("themeId") ?? "default");
    const themeId = isChatThemeId(themeIdRaw) ? themeIdRaw : "default";
    const blur = clampWallpaperBlur(Number(form.get("blur") ?? 6));
    const dim = clampWallpaperDim(Number(form.get("dim") ?? 40));
    const clearWallpaper = String(form.get("clearWallpaper") ?? "") === "1";

    let wallpaperUrl: string | null = null;
    const file = form.get("wallpaper");
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const saved = await saveFile(file as File, {
        maxSize: 8 * 1024 * 1024,
      });
      if (!saved || saved.type !== "image") {
        return NextResponse.json(
          { error: "Failed to upload wallpaper image." },
          { status: 400 }
        );
      }
      wallpaperUrl = saved.url;
    } else if (!clearWallpaper) {
      const existingUrl = String(form.get("wallpaperUrl") ?? "").trim();
      if (existingUrl.startsWith("/uploads/")) {
        wallpaperUrl = existingUrl;
      } else {
        const existing = conv.sharedTheme?.wallpaperUrl;
        if (typeof existing === "string" && existing) {
          wallpaperUrl = existing;
        }
      }
    }

    const isGroup = conv.type === "group";
    const admins = (conv.admins ?? []).map((a) => a.toString());
    const isAdmin = admins.includes(userId);

    if (isGroup) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Only group admins can set a shared theme." },
          { status: 403 }
        );
      }

      conv.set("sharedTheme", {
        themeId,
        blur,
        dim,
        wallpaperUrl,
        proposedBy: new Types.ObjectId(userId),
        acceptedAt: new Date(),
      });
      await conv.save();

      const others = (conv.participants ?? [])
        .map((p) => p.toString())
        .filter((id) => id !== userId);

      // No Activity spam — members pick up the theme via conversation SSE.
      void others;

      return NextResponse.json({
        applied: true,
        sharedTheme: {
          themeId,
          blur,
          dim,
          wallpaperUrl,
          proposedBy: userId,
          acceptedAt: new Date().toISOString(),
        },
      });
    }

    // Direct chat — propose to the other participant
    const peerId = (conv.participants ?? [])
      .map((p) => p.toString())
      .find((id) => id !== userId);

    if (!peerId) {
      return NextResponse.json(
        { error: "Peer not found." },
        { status: 400 }
      );
    }

    // Supersede prior pending proposals from this user in this chat
    const oldPending = await ThemeProposalModel.find({
      conversation: conversationId,
      from: userId,
      status: "pending",
    })
      .select("_id")
      .lean();

    const oldIds = oldPending.map((p) => p._id);
    if (oldIds.length > 0) {
      await ThemeProposalModel.deleteMany({ _id: { $in: oldIds } });
      await NotificationModel.deleteMany({
        type: "theme_proposal",
        themeProposal: { $in: oldIds },
      });
    }

    const proposal = await ThemeProposalModel.create({
      conversation: conversationId,
      from: userId,
      to: peerId,
      themeId,
      blur,
      dim,
      wallpaperUrl,
      status: "pending",
    });

    await createNotification({
      recipient: peerId,
      actor: userId,
      type: "theme_proposal",
      conversation: conversationId,
      themeProposal: proposal._id.toString(),
    });

    return NextResponse.json(
      {
        proposed: true,
        proposal: {
          _id: proposal._id.toString(),
          themeId,
          blur,
          dim,
          wallpaperUrl,
          conversation: conversationId,
          status: "pending",
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/conversations/[id]/theme/propose error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
