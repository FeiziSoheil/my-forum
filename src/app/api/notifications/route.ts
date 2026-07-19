import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { NotificationModel } from "@/models/Notification";
// Ensure referenced schemas are registered before populate() runs.
import "@/models/User";
import "@/models/Post";
import "@/models/FollowRequest";
import "@/models/ThemeProposal";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const [notifications, unreadCount] = await Promise.all([
      NotificationModel.find({ recipient: userId })
        .populate("actor", "username fullname avatar")
        .populate("post", "content")
        .populate("followRequest", "_id status")
        .populate(
          "themeProposal",
          "_id status themeId blur dim wallpaperUrl conversation"
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      NotificationModel.countDocuments({ recipient: userId, read: false }),
    ]);

    return NextResponse.json(
      { notifications, unreadCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
