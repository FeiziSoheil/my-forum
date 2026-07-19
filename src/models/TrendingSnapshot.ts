import { models, Schema, model } from "mongoose";

export const TRENDING_SNAPSHOT_ID = "global_48h";

/**
 * Singleton materialized trending candidate list for For-you.
 * Refreshed by scripts/computeTrending.ts.
 */
export const TrendingSnapshotSchema = new Schema(
  {
    _id: {
      type: String,
      default: TRENDING_SNAPSHOT_ID,
    },
    computedAt: {
      type: Date,
      required: true,
    },
    windowMs: {
      type: Number,
      required: true,
    },
    postIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    meta: {
      count: { type: Number, default: 0 },
      topLikesCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: false,
  }
);

if (models.TrendingSnapshot) {
  delete models.TrendingSnapshot;
}

export const TrendingSnapshotModel = model(
  "TrendingSnapshot",
  TrendingSnapshotSchema
);
