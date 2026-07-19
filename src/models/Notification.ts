import { Schema, models, model } from "mongoose";

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "like_post",
        "like_reply",
        "repost",
        "follow",
        "follow_request",
        "follow_accepted",
        "reply",
        "mention",
        "like_story",
        "story_reply",
        "message",
        "theme_proposal",
        "theme_accepted",
      ],
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    reply: {
      type: Schema.Types.ObjectId,
      ref: "Reply",
      default: null,
    },
    story: {
      type: Schema.Types.ObjectId,
      ref: "Story",
      default: null,
    },
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    // Set on `follow_request` so Activity can Accept/Reject inline.
    followRequest: {
      type: Schema.Types.ObjectId,
      ref: "FollowRequest",
      default: null,
    },
    // Set on `theme_proposal` so Activity can Accept/Reject inline.
    themeProposal: {
      type: Schema.Types.ObjectId,
      ref: "ThemeProposal",
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

if (models.Notification) {
  delete models.Notification;
}

export const NotificationModel = model("Notification", notificationSchema);
