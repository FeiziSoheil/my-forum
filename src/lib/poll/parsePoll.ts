import { randomUUID } from "crypto";
import {
  DEFAULT_POLL_DURATION,
  isPollDurationKey,
  POLL_DURATIONS,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  type PollDurationKey,
} from "@/lib/poll/constants";
import type { PostPoll, PostPollOption } from "@/types/post";

export type ParsedPollInput = {
  options: string[];
  duration: PollDurationKey;
};

export type PollParseResult =
  | { ok: true; poll: Omit<PostPoll, "votes"> }
  | { ok: false; error: string };

export function parsePollFormValue(raw: unknown): PollParseResult {
  if (raw == null || raw === "") {
    return { ok: false, error: "Poll payload is empty." };
  }

  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Invalid poll JSON." };
    }
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "Invalid poll payload." };
  }

  const obj = data as { options?: unknown; duration?: unknown };
  const durationRaw =
    typeof obj.duration === "string" ? obj.duration : DEFAULT_POLL_DURATION;
  if (!isPollDurationKey(durationRaw)) {
    return {
      ok: false,
      error: `Duration must be one of: ${Object.keys(POLL_DURATIONS).join(", ")}.`,
    };
  }

  if (!Array.isArray(obj.options)) {
    return { ok: false, error: "Poll options must be an array." };
  }

  const cleaned = obj.options
    .map((o) => (typeof o === "string" ? o.trim() : ""))
    .filter((o) => o.length > 0);

  if (cleaned.length < POLL_MIN_OPTIONS) {
    return {
      ok: false,
      error: `Poll needs at least ${POLL_MIN_OPTIONS} options.`,
    };
  }
  if (cleaned.length > POLL_MAX_OPTIONS) {
    return {
      ok: false,
      error: `Poll can have at most ${POLL_MAX_OPTIONS} options.`,
    };
  }

  for (const text of cleaned) {
    if (text.length > POLL_OPTION_MAX_LENGTH) {
      return {
        ok: false,
        error: `Each option can be at most ${POLL_OPTION_MAX_LENGTH} characters.`,
      };
    }
  }

  const unique = new Set(cleaned.map((t) => t.toLowerCase()));
  if (unique.size !== cleaned.length) {
    return { ok: false, error: "Poll options must be unique." };
  }

  const hours = POLL_DURATIONS[durationRaw].hours;
  const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const options: PostPollOption[] = cleaned.map((text) => ({
    id: randomUUID(),
    text,
    votesCount: 0,
  }));

  return {
    ok: true,
    poll: {
      options,
      endsAt,
      votesCount: 0,
    },
  };
}
