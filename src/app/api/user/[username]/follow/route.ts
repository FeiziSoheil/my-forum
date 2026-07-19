import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import {
  createFollowEdge,
  deleteFollowEdge,
  viewerFollowsAuthor,
} from "@/lib/follow/edges";
import { createNotification } from "@/lib/notifications/createNotification";
import { FollowRequestModel } from "@/models/FollowRequest";
import { NotificationModel } from "@/models/Notification";
import { UserModel } from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const { username } = await params;

    const target = await UserModel.findOne({
      username,
      isDeleted: { $ne: true },
    }).select("_id isPrivate");
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const targetId = target._id.toString();
    if (targetId === userId) {
      return NextResponse.json(
        { error: "You cannot follow yourself." },
        { status: 400 }
      );
    }

    const alreadyFollowing = await viewerFollowsAuthor(userId, targetId);
    if (alreadyFollowing) {
      return NextResponse.json(
        {
          following: true,
          requested: false,
          followersCount: (
            await UserModel.findById(targetId).select("followersCount")
          )?.followersCount ?? 0,
        },
        { status: 200 }
      );
    }

    // Private account → pending follow request (no access until accepted)
    if (target.isPrivate) {
      const existing = await FollowRequestModel.findOne({
        from: userId,
        to: targetId,
        status: "pending",
      })
        .select("_id")
        .lean();

      if (!existing) {
        try {
          const created = await FollowRequestModel.create({
            from: userId,
            to: targetId,
            status: "pending",
          });
          await createNotification({
            recipient: targetId,
            actor: userId,
            type: "follow_request",
            followRequest: created._id.toString(),
          });
        } catch (err: unknown) {
          // Unique index race: another concurrent request already created it
          const code = (err as { code?: number })?.code;
          if (code !== 11000) throw err;
        }
      }

      const updated = await UserModel.findById(targetId).select("followersCount");
      return NextResponse.json(
        {
          following: false,
          requested: true,
          followersCount: updated?.followersCount ?? 0,
        },
        { status: 200 }
      );
    }

    // Public account → immediate follow (dual-write User arrays + Follow edge)
    const followResult = await UserModel.updateOne(
      { _id: targetId, "followers.user": { $ne: userId } },
      { $push: { followers: { user: userId } }, $inc: { followersCount: 1 } }
    );
    await UserModel.updateOne(
      { _id: userId, "following.user": { $ne: targetId } },
      { $push: { following: { user: targetId } }, $inc: { followingCount: 1 } }
    );
    await createFollowEdge(userId, targetId);

    // Clear any stale pending request if account was recently made public
    await FollowRequestModel.deleteOne({ from: userId, to: targetId });

    const updated = await UserModel.findById(targetId).select("followersCount");
    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (followResult.modifiedCount > 0) {
      await createNotification({
        recipient: targetId,
        actor: userId,
        type: "follow",
      });
    }

    return NextResponse.json(
      {
        following: true,
        requested: false,
        followersCount: updated.followersCount,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/user/[username]/follow error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const { username } = await params;

    const target = await UserModel.findOne({
      username,
      isDeleted: { $ne: true },
    }).select("_id");
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const targetId = target._id.toString();
    if (targetId === userId) {
      return NextResponse.json(
        { error: "You cannot unfollow yourself." },
        { status: 400 }
      );
    }

    // Cancel pending request if any (no count changes)
    const cancelled = await FollowRequestModel.deleteOne({
      from: userId,
      to: targetId,
      status: "pending",
    });

    if (cancelled.deletedCount > 0) {
      await NotificationModel.deleteMany({
        recipient: targetId,
        actor: userId,
        type: "follow_request",
      });
    }

    // Unfollow if following (dual-write User arrays + Follow edge)
    await UserModel.updateOne(
      { _id: targetId, "followers.user": userId },
      { $pull: { followers: { user: userId } }, $inc: { followersCount: -1 } }
    );
    await UserModel.updateOne(
      { _id: userId, "following.user": targetId },
      { $pull: { following: { user: targetId } }, $inc: { followingCount: -1 } }
    );
    await deleteFollowEdge(userId, targetId);

    const updated = await UserModel.findById(targetId).select("followersCount");
    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        following: false,
        requested: false,
        cancelled: cancelled.deletedCount > 0,
        followersCount: updated.followersCount,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE /api/user/[username]/follow error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
