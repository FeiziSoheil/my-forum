import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { createFollowEdge } from "@/lib/follow/edges";
import { createNotification } from "@/lib/notifications/createNotification";
import { FollowRequestModel } from "@/models/FollowRequest";
import { NotificationModel } from "@/models/Notification";
import { UserModel } from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/user/follow-requests/[id]/accept
 * Owner accepts a pending request: create follow relationship, delete request,
 * notify the requester with `follow_accepted`.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const { id } = await params;

    const request = await FollowRequestModel.findById(id);
    if (!request || request.status !== "pending") {
      return NextResponse.json(
        { error: "Follow request not found." },
        { status: 404 }
      );
    }

    if (request.to.toString() !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const fromId = request.from.toString();

    const requester = await UserModel.findById(fromId)
      .select("_id isDeleted")
      .lean();
    if (!requester || (requester as { isDeleted?: boolean }).isDeleted) {
      await FollowRequestModel.deleteOne({ _id: id });
      return NextResponse.json(
        { error: "Requester account is unavailable." },
        { status: 404 }
      );
    }

    const followResult = await UserModel.updateOne(
      { _id: userId, "followers.user": { $ne: fromId } },
      { $push: { followers: { user: fromId } }, $inc: { followersCount: 1 } }
    );
    await UserModel.updateOne(
      { _id: fromId, "following.user": { $ne: userId } },
      { $push: { following: { user: userId } }, $inc: { followingCount: 1 } }
    );
    await createFollowEdge(fromId, userId);

    await FollowRequestModel.deleteOne({ _id: id });

    // Mark related follow_request notifications as read for the owner
    await NotificationModel.updateMany(
      {
        recipient: userId,
        actor: fromId,
        type: "follow_request",
        read: false,
      },
      { $set: { read: true } }
    );

    if (followResult.modifiedCount > 0) {
      await createNotification({
        recipient: fromId,
        actor: userId,
        type: "follow_accepted",
      });
    }

    const updated = await UserModel.findById(userId).select("followersCount");

    return NextResponse.json(
      {
        accepted: true,
        following: true,
        followersCount: updated?.followersCount ?? 0,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/user/follow-requests/[id]/accept error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
