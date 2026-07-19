import { MediaItem } from "@/types/post";
import { StorySnapshot } from "@/types/story";
import type {
  PendingThemeProposal,
  SharedChatTheme,
} from "@/types/chatTheme";

export interface ChatUser {
  _id: string;
  username: string;
  fullname: string;
  avatar?: string;
}

export interface MessageReaction {
  emoji: string;
  user: ChatUser | string;
  createdAt: string | Date;
}

export interface SharedPostPreview {
  _id: string;
  content: string;
  media?: MediaItem[];
  author: ChatUser;
  createdAt: string | Date;
}

/** Lightweight preview of the message being replied to */
export interface ReplyPreview {
  _id: string;
  content: string;
  type: "text" | "image" | "shared_post" | "story_reply";
  sender: ChatUser | string;
  media?: MediaItem[];
  sharedPost?: SharedPostPreview | string | null;
  storySnapshot?: StorySnapshot | null;
  isDeleted?: boolean;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: ChatUser | string;
  content: string;
  media?: MediaItem[];
  type: "text" | "image" | "shared_post" | "story_reply";
  replyTo?: ReplyPreview | string | null;
  sharedPost?: SharedPostPreview | string | null;
  sharedStory?: string | null;
  storySnapshot?: StorySnapshot | null;
  reactions?: MessageReaction[];
  reactionsUpdatedAt?: string | Date | null;
  isDeleted?: boolean;
  deletedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PresenceStatus {
  online: boolean;
  lastSeenAt: string | null;
}

export interface TypingUser {
  userId: string;
  username?: string;
  fullname?: string;
}

export interface TypingStatus {
  /** Peer user id (direct chats) */
  userId?: string;
  typing: boolean;
  /** All users currently typing (groups; may include peer for direct) */
  users?: TypingUser[];
}

export type ConversationType = "direct" | "group";

export interface Conversation {
  _id: string;
  type: ConversationType;
  title?: string | null;
  createdBy?: string | null;
  admins?: string[];
  isAdmin?: boolean;
  participants: ChatUser[];
  memberCount?: number;
  /** Other participants currently online (groups) */
  onlineCount?: number;
  /** Peer in a 1:1 chat */
  otherUser?: ChatUser;
  otherUserPresence?: PresenceStatus;
  lastMessage?: ChatMessage | null;
  lastMessageAt?: string | Date | null;
  unreadCount: number;
  /** Agreed conversation theme (after peer accepts, or group admin apply). */
  sharedTheme?: SharedChatTheme | null;
  /** Live pending theme invite for this DM (incoming or outgoing). */
  pendingThemeProposal?: PendingThemeProposal | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface MessagesPage {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface StartConversationRequest {
  userId: string;
}

export interface CreateGroupConversationRequest {
  type: "group";
  title: string;
  participantIds: string[];
}

/** Default reaction bar in the message popup (7 + “more” icon). */
export const QUICK_REACTIONS = [
  "❤️",
  "😂",
  "😮",
  "😢",
  "🙏",
  "👍",
  "🔥",
] as const;

export const REACTION_CATEGORIES = [
  {
    id: "frequent",
    label: "Frequent",
    emojis: ["❤️", "😂", "😮", "😢", "🙏", "👍", "🔥", "👏"],
  },
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀",
      "😁",
      "😅",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "😉",
      "😍",
      "🥰",
      "😘",
      "😎",
      "🤩",
      "🤔",
      "🤨",
      "😐",
      "😴",
      "🥺",
      "😭",
      "😤",
      "🤯",
      "😱",
      "🤗",
      "🤭",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: [
      "👍",
      "👎",
      "👌",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👋",
      "🙌",
      "👏",
      "🤝",
      "💪",
      "🙏",
      "🫡",
      "🫶",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
    ],
  },
  {
    id: "objects",
    label: "More",
    emojis: [
      "🔥",
      "✨",
      "⭐",
      "🌟",
      "💯",
      "🎉",
      "🎊",
      "🎈",
      "🎁",
      "🏆",
      "🎯",
      "💡",
      "☕",
      "🍕",
      "🌹",
      "🍀",
    ],
  },
] as const;

export const REACTION_EMOJIS = Array.from(
  new Set(REACTION_CATEGORIES.flatMap((c) => [...c.emojis]))
);

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
