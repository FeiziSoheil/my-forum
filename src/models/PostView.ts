import { models, Schema, model } from "mongoose";

export const PostViewSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

PostViewSchema.index({ user: 1, post: 1 }, { unique: true });
PostViewSchema.index({ user: 1, viewedAt: -1 });
PostViewSchema.index({ post: 1, createdAt: -1 });

if (models.PostView) {
  delete models.PostView;
}

export const PostViewModel = model("PostView", PostViewSchema);
