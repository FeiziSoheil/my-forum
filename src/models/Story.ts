import { Schema, models, model } from "mongoose";

const storySchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video"],
      required: true,
    },
    content: {
      type: String,
      default: "",
      maxlength: [500, "Content cannot be more than 500 characters"],
      trim: true,
    },
    media: [
      {
        type: {
          type: String,
          enum: ["image", "video", "gif", "file"],
          required: true,
        },
        url: { type: String, required: true },
        alt: String,
        size: Number,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    backgroundColor: {
      type: String,
      default: "#1a1a2e",
    },
    likesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    likes: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    viewers: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

storySchema.index({ author: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1, author: 1 });

// TTL index: Mongo auto-removes expired story documents (sweep runs ~every 60s).
// Runtime queries still filter `expiresAt > now` as a safety net for that delay.
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

if (models.Story) {
  delete models.Story;
}

export const StoryModel = model("Story", storySchema);
