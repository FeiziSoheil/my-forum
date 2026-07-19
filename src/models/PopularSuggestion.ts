import { models, Schema, model } from "mongoose";

/**
 * Precomputed global popular-people suggestions.
 * Refreshed by scripts/computeTrending.ts (precomputeRecommendations).
 */
export const PopularSuggestionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rank: { type: Number, required: true },
    score: { type: Number, required: true },
    computedAt: { type: Date, required: true },
  },
  { timestamps: false }
);

PopularSuggestionSchema.index({ user: 1 }, { unique: true });
PopularSuggestionSchema.index({ rank: 1 });
PopularSuggestionSchema.index({ computedAt: -1 });

if (models.PopularSuggestion) {
  delete models.PopularSuggestion;
}

export const PopularSuggestionModel = model(
  "PopularSuggestion",
  PopularSuggestionSchema
);
