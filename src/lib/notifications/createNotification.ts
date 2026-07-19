import { NotificationModel } from "@/models/Notification";
import { NotificationType } from "@/types/notification";

export type CreateNotificationInput = {
  recipient: string;
  actor: string;
  type: NotificationType;
  post?: string | null;
  reply?: string | null;
  story?: string | null;
  conversation?: string | null;
  followRequest?: string | null;
  themeProposal?: string | null;
};

/**
 * Creates a notification. Never throws — failures are logged so the
 * primary like/follow/repost/reply mutation is not affected.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  try {
    const {
      recipient,
      actor,
      type,
      post,
      reply,
      story,
      conversation,
      followRequest,
      themeProposal,
    } = input;

    if (!recipient || !actor || recipient === actor) return;

    // Dedupe recent unread identical like/follow/repost/mention/message
    // (skip reply / story_reply — each is a distinct event). For `message`
    // this collapses repeated unread DMs from the same actor in the same
    // conversation into a single notification until the recipient reads it.
    // theme_proposal is superseded explicitly by the propose route.
    if (
      type !== "reply" &&
      type !== "story_reply" &&
      type !== "theme_proposal"
    ) {
      const existing = await NotificationModel.findOne({
        recipient,
        actor,
        type,
        read: false,
        ...(post ? { post } : { post: null }),
        ...(reply ? { reply } : { reply: null }),
        ...(story ? { story } : { story: null }),
        ...(conversation ? { conversation } : { conversation: null }),
        ...(followRequest ? { followRequest } : { followRequest: null }),
        ...(themeProposal ? { themeProposal } : { themeProposal: null }),
      })
        .select("_id")
        .lean();

      if (existing) return;
    }

    await NotificationModel.create({
      recipient,
      actor,
      type,
      post: post ?? null,
      reply: reply ?? null,
      story: story ?? null,
      conversation: conversation ?? null,
      followRequest: followRequest ?? null,
      themeProposal: themeProposal ?? null,
      read: false,
    });
  } catch (err) {
    console.error("createNotification error:", err);
  }
}
