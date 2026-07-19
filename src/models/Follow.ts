import { models, Schema, model } from "mongoose";

/**
 * Directed follow edge: follower → following.
 * Phase 3 source of truth for FoF / suggestions; User arrays remain dual-written.
 */
export const FollowSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

FollowSchema.index({ follower: 1, following: 1 }, { unique: true });
FollowSchema.index({ following: 1, follower: 1 });
FollowSchema.index({ follower: 1, createdAt: -1 });
FollowSchema.index({ following: 1, createdAt: -1 });

if (models.Follow) {
  delete models.Follow;
}

export const FollowModel = model("Follow", FollowSchema);
