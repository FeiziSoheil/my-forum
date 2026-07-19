import { Schema, models, model, Types } from "mongoose";

const conversationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      index: true,
    },
    title: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    admins: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      validate: {
        validator: function (this: { type?: string }, v: unknown[]) {
          if (!Array.isArray(v)) return false;
          const unique = new Set(v.map((id) => String(id)));
          if (unique.size !== v.length) return false;
          if (this.type === "group") return v.length >= 3;
          return v.length === 2;
        },
        message:
          "Direct chats need exactly 2 participants; groups need at least 3",
      },
      required: true,
    },
    /**
     * Direct: sorted participant ids joined by `_` (unique pair lookup).
     * Group: `group_<ObjectId>` (always unique; no member-based dedupe).
     */
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    readState: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        lastReadAt: { type: Date, default: Date.now },
      },
    ],
    /** Ephemeral typing indicators; entries expire via expiresAt (short TTL). */
    typing: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        expiresAt: { type: Date, required: true },
      },
    ],
    /**
     * Theme both participants agreed on (direct) or admin applied (group).
     * Personal local overrides remain possible on the client.
     */
    sharedTheme: {
      themeId: { type: String, default: null },
      blur: { type: Number, default: 6 },
      dim: { type: Number, default: 40 },
      wallpaperUrl: { type: String, default: null },
      proposedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      acceptedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

conversationSchema.pre("validate", function (next) {
  if (this.type === "group") {
    const title = typeof this.title === "string" ? this.title.trim() : "";
    if (!title) {
      this.invalidate("title", "Group conversations require a title");
    } else {
      this.title = title;
    }
  }
  next();
});

conversationSchema.index({ participants: 1 });

export function buildParticipantKey(userA: string, userB: string): string {
  return [userA, userB].sort().join("_");
}

export function buildGroupParticipantKey(id?: string): string {
  return `group_${id || new Types.ObjectId().toString()}`;
}

// Ensure schema updates apply when the module reloads under Next.js HMR
if (models.Conversation) {
  delete models.Conversation;
}

export const ConversationModel = model("Conversation", conversationSchema);
