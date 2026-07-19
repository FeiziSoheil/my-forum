import { dbConnect } from "@/lib/db/mongodb";
import { PostModel } from "@/models/Post";
import { PipelineStage } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

/** Distinct post tags matching a prefix (case-insensitive). Empty `q` → popular tags. */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 10) || 10,
      20
    );

    const pipeline: PipelineStage[] = [
      { $match: { isDeleted: { $ne: true }, tags: { $exists: true, $ne: [] } } },
      { $unwind: "$tags" },
    ];

    if (q.length > 0) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pipeline.push({
        $match: { tags: { $regex: `^${escaped}`, $options: "i" } },
      });
    }

    pipeline.push(
      { $group: { _id: { $toLower: "$tags" }, count: { $sum: 1 } } },
      { $sort: q.length > 0 ? { _id: 1 } : { count: -1, _id: 1 } },
      { $limit: limit },
      { $project: { _id: 0, tag: "$_id" } }
    );

    const rows = await PostModel.aggregate<{ tag: string }>(pipeline);

    return NextResponse.json(
      { tags: rows.map((r) => r.tag).filter(Boolean) },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/tags/suggest error:", err);
    return NextResponse.json(
      { error: "Failed to suggest tags" },
      { status: 500 }
    );
  }
}
