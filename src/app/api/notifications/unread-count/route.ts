import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { NotificationModel } from "@/models/Notification";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const unreadCount = await NotificationModel.countDocuments({
      recipient: userId,
      read: false,
    });

    return NextResponse.json({ unreadCount }, { status: 200 });
  } catch (err) {
    console.error("GET /api/notifications/unread-count error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
