import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { FollowRequestModel } from "@/models/FollowRequest";
import { NextResponse } from "next/server";

/**
 * GET /api/user/follow-requests
 * Incoming pending follow requests for the current (private) account owner.
 */
export async function GET() {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const requests = await FollowRequestModel.find({
      to: userId,
      status: "pending",
    })
      .populate("from", "username fullname avatar isDeleted")
      .sort({ createdAt: -1 })
      .lean();

    const items = requests
      .filter((r) => {
        const from = r.from as
          | { _id: unknown; username?: string; isDeleted?: boolean }
          | null;
        return from && !from.isDeleted && from.username;
      })
      .map((r) => {
        const from = r.from as {
          _id: unknown;
          username: string;
          fullname: string;
          avatar?: string;
        };
        return {
          _id: r._id,
          createdAt: r.createdAt,
          from: {
            _id: from._id,
            username: from.username,
            fullname: from.fullname,
            avatar: from.avatar,
          },
        };
      });

    return NextResponse.json({ requests: items }, { status: 200 });
  } catch (err) {
    console.error("GET /api/user/follow-requests error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
