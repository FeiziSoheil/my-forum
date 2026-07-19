import { dbConnect } from "@/lib/db/mongodb";
import { getOptionalUserId } from "@/lib/auth/session";
import { UserModel } from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const userId = await getOptionalUserId(req);

    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (q.length < 1) {
      return NextResponse.json({ users: [] }, { status: 200 });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const filter: Record<string, unknown> = {
      $or: [{ username: regex }, { fullname: regex }],
    };
    if (userId) {
      filter._id = { $ne: userId };
    }

    const users = await UserModel.find(filter)
      .select("username fullname avatar")
      .limit(20)
      .lean();

    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users/search error:", err);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
