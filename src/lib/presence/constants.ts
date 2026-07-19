/** Missed-heartbeat threshold: user is offline if lastSeenAt is older than this. */
export const PRESENCE_ONLINE_MS = 55_000;

/** Client heartbeat interval while on /messages. */
export const PRESENCE_HEARTBEAT_MS = 20_000;

/** Typing indicator expires if no refresh within this window. */
export const TYPING_TTL_MS = 3_000;

/** Client stops emitting typing after this idle gap. */
export const TYPING_IDLE_MS = 2_000;
