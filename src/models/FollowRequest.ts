import { Schema, models, model } from "mongoose";

/**
 * Pending follow requests for private accounts.
 * Created when Y requests to follow private X; deleted on accept / reject / cancel.
 * Accepting creates the real follow relationship on User.followers / following.
 *
 * Policy when X switches private → public while requests are pending:
 * leave them until X accepts (or Y cancels). New follows on public become immediate.
 */
const followRequestSchema = new Schema(
  {
    from: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

followRequestSchema.index({ from: 1, to: 1 }, { unique: true });
followRequestSchema.index({ to: 1, createdAt: -1 });

export const FollowRequestModel =
  models.FollowRequest || model("FollowRequest", followRequestSchema);
