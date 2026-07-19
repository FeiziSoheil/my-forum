import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { NotificationModel } from "@/models/Notification";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    let ids: string[] | undefined;
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids)) {
        ids = body.ids.filter(
          (id: unknown): id is string =>
            typeof id === "string" && isValidObjectId(id)
        );
      }
    } catch {
      // empty body = mark all
    }

    const filter: Record<string, unknown> = {
      recipient: userId,
      read: false,
    };
    if (ids && ids.length > 0) {
      filter._id = { $in: ids };
    }

    const result = await NotificationModel.updateMany(filter, {
      $set: { read: true },
    });

    return NextResponse.json(
      { marked: result.modifiedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/notifications/read error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
