import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { NextResponse } from "next/server";

/**
 * Presence heartbeat. Clients on /messages POST every ~20s while the tab is open.
 * Online status is derived from lastSeenAt (see PRESENCE_ONLINE_MS).
 */
export async function POST() {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const now = new Date();
    await UserModel.updateOne(
      { _id: userId, isDeleted: { $ne: true } },
      { $set: { lastSeenAt: now } }
    );

    return NextResponse.json(
      { ok: true, lastSeenAt: now.toISOString() },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/presence/heartbeat error:", err);
    return NextResponse.json(
      { error: "Failed to update presence" },
      { status: 500 }
    );
  }
}
