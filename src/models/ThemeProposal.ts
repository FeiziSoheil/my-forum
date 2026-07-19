import { Schema, models, model } from "mongoose";

/**
 * Pending chat-theme proposals (direct chats).
 * Created when X asks Y to apply X's look; deleted on accept / reject / supersede.
 */
const themeProposalSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    from: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    themeId: {
      type: String,
      required: true,
      maxlength: 40,
    },
    blur: {
      type: Number,
      default: 6,
      min: 0,
      max: 24,
    },
    dim: {
      type: Number,
      default: 40,
      min: 0,
      max: 80,
    },
    wallpaperUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

themeProposalSchema.index({ conversation: 1, from: 1, status: 1 });
themeProposalSchema.index({ to: 1, createdAt: -1 });

export const ThemeProposalModel =
  models.ThemeProposal || model("ThemeProposal", themeProposalSchema);
