/** Shared / proposed chat theme payload (server + client). */

export type SharedChatTheme = {
  themeId: string;
  blur: number;
  dim: number;
  wallpaperUrl: string | null;
  proposedBy: string;
  acceptedAt: string;
};

export type ThemeProposalPreview = {
  _id: string;
  status: "pending";
  themeId: string;
  blur: number;
  dim: number;
  wallpaperUrl: string | null;
  conversation: string;
};

/** Pending DM theme invite attached to a conversation payload / SSE. */
export type PendingThemeProposal = ThemeProposalPreview & {
  from: string;
  to: string;
  /** Current viewer is the recipient (can Accept / Reject). */
  isIncoming: boolean;
  createdAt?: string;
};
