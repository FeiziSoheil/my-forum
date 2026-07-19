import { dbConnect } from "@/lib/db/mongodb";
import { getOptionalUserId } from "@/lib/auth/session";
import { getSuggestedPeople } from "@/lib/recommendations/suggestPeople";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const userId = await getOptionalUserId(req);
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 8) || 8,
      20
    );

    const users = await getSuggestedPeople({ userId, limit });

    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users/suggestions error:", err);
    return NextResponse.json(
      { error: "Failed to load suggestions" },
      { status: 500 }
    );
  }
}
