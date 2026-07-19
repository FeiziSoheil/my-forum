import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { FollowRequestModel } from "@/models/FollowRequest";
import { NotificationModel } from "@/models/Notification";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/user/follow-requests/[id]/reject
 * Owner rejects a pending request: delete request, no follow relationship.
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

    await FollowRequestModel.deleteOne({ _id: id });

    // Mark related follow_request notifications as read
    await NotificationModel.updateMany(
      {
        recipient: userId,
        actor: fromId,
        type: "follow_request",
        read: false,
      },
      { $set: { read: true } }
    );

    return NextResponse.json({ rejected: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/user/follow-requests/[id]/reject error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
