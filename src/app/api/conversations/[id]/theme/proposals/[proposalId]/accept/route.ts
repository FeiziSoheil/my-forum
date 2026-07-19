import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { createNotification } from "@/lib/notifications/createNotification";
import { ConversationModel } from "@/models/Conversation";
import { NotificationModel } from "@/models/Notification";
import { ThemeProposalModel } from "@/models/ThemeProposal";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/conversations/[id]/theme/proposals/[proposalId]/accept
 * Peer accepts → write conversation.sharedTheme, notify proposer.
 */
export async function POST(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;
    const { id: conversationId, proposalId } = await params;

    const proposal = await ThemeProposalModel.findById(proposalId);
    if (!proposal || proposal.status !== "pending") {
      return NextResponse.json(
        { error: "Theme proposal not found." },
        { status: 404 }
      );
    }

    if (proposal.conversation.toString() !== conversationId) {
      return NextResponse.json({ error: "Mismatch." }, { status: 400 });
    }

    if (proposal.to.toString() !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

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

    const fromId = proposal.from.toString();
    const acceptedAt = new Date();

    conv.set("sharedTheme", {
      themeId: proposal.themeId,
      blur: proposal.blur,
      dim: proposal.dim,
      wallpaperUrl: proposal.wallpaperUrl ?? null,
      proposedBy: proposal.from,
      acceptedAt,
    });
    await conv.save();

    await ThemeProposalModel.deleteOne({ _id: proposalId });

    await NotificationModel.updateMany(
      {
        recipient: userId,
        type: "theme_proposal",
        themeProposal: proposalId,
        read: false,
      },
      { $set: { read: true } }
    );

    await createNotification({
      recipient: fromId,
      actor: userId,
      type: "theme_accepted",
      conversation: conversationId,
    });

    const sharedTheme = {
      themeId: proposal.themeId,
      blur: proposal.blur,
      dim: proposal.dim,
      wallpaperUrl: proposal.wallpaperUrl ?? null,
      proposedBy: fromId,
      acceptedAt: acceptedAt.toISOString(),
    };

    return NextResponse.json({ accepted: true, sharedTheme });
  } catch (err) {
    console.error(
      "POST /api/conversations/[id]/theme/proposals/[proposalId]/accept error:",
      err
    );
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
