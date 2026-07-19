import { dbConnect } from "@/lib/db/mongodb";
import { listFollowUsers } from "@/lib/follow/listFollowUsers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    await dbConnect();
    const { username } = await params;
    const result = await listFollowUsers(req, username, "following");
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("GET /api/user/[username]/following error:", err);
    return NextResponse.json(
      { error: "Failed to fetch following" },
      { status: 500 }
    );
  }
}
