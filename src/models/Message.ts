import { Schema, models, model } from "mongoose";

const reactionSchema = new Schema(
  {
    emoji: {
      type: String,
      required: true,
      maxlength: 8,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const storySnapshotSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["text", "image", "video"],
    },
    content: { type: String, default: "" },
    mediaUrl: { type: String, default: null },
    backgroundColor: { type: String, default: null },
    authorUsername: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
      maxlength: [2000, "Content cannot be more than 2000 characters"],
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
    type: {
      type: String,
      enum: ["text", "image", "shared_post", "story_reply"],
      default: "text",
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    sharedPost: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    sharedStory: {
      type: Schema.Types.ObjectId,
      ref: "Story",
      default: null,
    },
    storySnapshot: {
      type: storySnapshotSchema,
      default: undefined,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    reactionsUpdatedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, _id: -1 });
messageSchema.index({ conversation: 1, reactionsUpdatedAt: -1 });
messageSchema.index({ conversation: 1, deletedAt: -1 });

// Ensure schema updates apply when the module reloads under Next.js HMR
if (models.Message) {
  delete models.Message;
}

export const MessageModel = model("Message", messageSchema);
