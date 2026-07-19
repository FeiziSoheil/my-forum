export type NotificationType =
  | "like_post"
  | "like_reply"
  | "repost"
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "reply"
  | "mention"
  | "like_story"
  | "story_reply"
  | "message"
  | "theme_proposal"
  | "theme_accepted";

export interface NotificationActor {
  _id: string;
  username: string;
  fullname: string;
  avatar?: string;
}

export interface NotificationPostPreview {
  _id: string;
  content: string;
}

export interface FollowRequestRef {
  _id: string;
  status: "pending" | "accepted" | "rejected";
}

export interface ThemeProposalRef {
  _id: string;
  status: "pending";
  themeId?: string;
  blur?: number;
  dim?: number;
  wallpaperUrl?: string | null;
  conversation?: string;
}

export interface Notification {
  _id: string;
  recipient: string;
  actor: NotificationActor;
  type: NotificationType;
  post?: NotificationPostPreview | string | null;
  reply?: string | null;
  story?: string | null;
  conversation?: string | null;
  /**
   * Present on `follow_request` notifications for Accept/Reject actions.
   * Populated to the live FollowRequest doc; becomes `null` once the request
   * is accepted/rejected (the doc is deleted), which hides the inline actions.
   */
  followRequest?: FollowRequestRef | string | null;
  /** Present on `theme_proposal` for Accept/Reject — null after resolved. */
  themeProposal?: ThemeProposalRef | string | null;
  read: boolean;
  createdAt: string | Date;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
