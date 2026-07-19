import { ChatMessage } from "@/types/chat";

export function senderId(sender: ChatMessage["sender"]): string {
  if (typeof sender === "string") return sender;
  return sender._id;
}

export type MessageGroupMeta = {
  isFirst: boolean;
  isLast: boolean;
  /** Extra top margin when switching senders / starting a new group */
  isGroupStart: boolean;
};

const GROUP_GAP_MS = 2 * 60 * 1000;

/**
 * Consecutive messages from the same sender within a short window
 * form a visual group (tighter gaps + connected corner radii).
 */
export function getMessageGroupMeta(
  messages: ChatMessage[],
  index: number
): MessageGroupMeta {
  const msg = messages[index];
  const prev = messages[index - 1];
  const next = messages[index + 1];
  const sid = senderId(msg.sender);

  const sameAsPrev =
    !!prev &&
    senderId(prev.sender) === sid &&
    Math.abs(
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()
    ) < GROUP_GAP_MS;

  const sameAsNext =
    !!next &&
    senderId(next.sender) === sid &&
    Math.abs(
      new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime()
    ) < GROUP_GAP_MS;

  return {
    isFirst: !sameAsPrev,
    isLast: !sameAsNext,
    isGroupStart: !sameAsPrev,
  };
}

export function bubbleRadiusClasses(
  isMine: boolean,
  isFirst: boolean,
  isLast: boolean
): string {
  if (isMine) {
    if (isFirst && isLast) return "rounded-2xl rounded-br-md";
    if (isFirst && !isLast) return "rounded-2xl rounded-br-lg";
    if (!isFirst && !isLast) return "rounded-2xl rounded-r-lg";
    return "rounded-2xl rounded-tr-lg rounded-br-md";
  }
  if (isFirst && isLast) return "rounded-2xl rounded-bl-md";
  if (isFirst && !isLast) return "rounded-2xl rounded-bl-lg";
  if (!isFirst && !isLast) return "rounded-2xl rounded-l-lg";
  return "rounded-2xl rounded-tl-lg rounded-bl-md";
}
