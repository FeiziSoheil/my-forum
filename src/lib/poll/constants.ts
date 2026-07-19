export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX_LENGTH = 25;

export const POLL_DURATIONS = {
  "1h": { hours: 1, label: "1 hour" },
  "6h": { hours: 6, label: "6 hours" },
  "12h": { hours: 12, label: "12 hours" },
  "1d": { hours: 24, label: "1 day" },
  "3d": { hours: 72, label: "3 days" },
  "7d": { hours: 168, label: "7 days" },
} as const;

export type PollDurationKey = keyof typeof POLL_DURATIONS;

export const DEFAULT_POLL_DURATION: PollDurationKey = "1d";

export function isPollDurationKey(value: string): value is PollDurationKey {
  return value in POLL_DURATIONS;
}

export function isPollEnded(endsAt: Date | string): boolean {
  return new Date(endsAt).getTime() <= Date.now();
}
