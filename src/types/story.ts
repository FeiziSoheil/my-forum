import { MediaItem } from "@/types/post";

export type StoryType = "text" | "image" | "video";

export const STORY_BACKGROUND_COLORS = [
  "#1a1a2e",
  "#16213e",
  "#0f3460",
  "#533483",
  "#e94560",
  "#c84b31",
  "#2d6a4f",
  "#1b4332",
] as const;

export type StoryBackgroundColor = (typeof STORY_BACKGROUND_COLORS)[number];

export interface StoryAuthor {
  _id: string;
  username: string;
  fullname: string;
  avatar?: string;
}

export interface Story {
  _id: string;
  author: StoryAuthor;
  type: StoryType;
  content: string;
  media?: MediaItem[];
  backgroundColor?: string;
  likesCount: number;
  viewsCount: number;
  expiresAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
  isLiked?: boolean;
  hasViewed?: boolean;
}

export interface StoryGroup {
  author: StoryAuthor;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string | Date;
}

export interface StoriesFeedResponse {
  groups: StoryGroup[];
}

export interface StoryViewerUser {
  _id: string;
  username: string;
  fullname: string;
  avatar?: string;
  viewedAt: string | Date;
}

export interface StoryViewersResponse {
  viewers: StoryViewerUser[];
  viewsCount: number;
}

export interface StorySnapshot {
  type: StoryType;
  content: string;
  mediaUrl?: string | null;
  backgroundColor?: string | null;
  authorUsername: string;
}
