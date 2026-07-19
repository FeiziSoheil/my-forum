import { models, Schema, model } from "mongoose";

export const PostFeedbackSchema = new Schema(
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
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    type: {
      type: String,
      enum: ["not_interested"],
      required: true,
      default: "not_interested",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

PostFeedbackSchema.index({ user: 1, post: 1, type: 1 }, { unique: true });
PostFeedbackSchema.index({ user: 1, type: 1, createdAt: -1 });
PostFeedbackSchema.index({ user: 1, author: 1, type: 1 });

if (models.PostFeedback) {
  delete models.PostFeedback;
}

export const PostFeedbackModel = model("PostFeedback", PostFeedbackSchema);
