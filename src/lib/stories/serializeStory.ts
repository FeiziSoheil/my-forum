import { isLikedBy } from "@/lib/auth/session";
import { Story, StoryAuthor } from "@/types/story";

export const STORY_AUTHOR_SELECT = "username fullname avatar";

export type LeanStory = {
  _id: { toString(): string };
  author:
    | {
        _id: { toString(): string };
        username: string;
        fullname: string;
        avatar?: string;
      }
    | { toString(): string };
  type: "text" | "image" | "video";
  content?: string;
  media?: Story["media"];
  backgroundColor?: string;
  likesCount?: number;
  viewsCount?: number;
  likes?: { user?: { toString(): string } | null }[];
  viewers?: { user?: { toString(): string } | null }[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function serializeAuthor(author: LeanStory["author"]): StoryAuthor | null {
  if (!author || typeof author === "string" || !("username" in author)) {
    return null;
  }
  return {
    _id: author._id.toString(),
    username: author.username,
    fullname: author.fullname,
    avatar: author.avatar,
  };
}

export function serializeStory(
  story: LeanStory,
  userId: string | null
): Story | null {
  const author = serializeAuthor(story.author);
  if (!author) return null;

  return {
    _id: story._id.toString(),
    author,
    type: story.type,
    content: story.content ?? "",
    media: story.media,
    backgroundColor: story.backgroundColor,
    likesCount: story.likesCount ?? 0,
    viewsCount: story.viewsCount ?? 0,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
    isLiked: isLikedBy(story.likes, userId),
    hasViewed:
      !!userId &&
      (story.viewers ?? []).some((v) => v.user?.toString() === userId),
  };
}

export function isStoryActive(expiresAt: Date | string): boolean {
  return new Date(expiresAt).getTime() > Date.now();
}
