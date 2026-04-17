import type { MatchLifecycle } from "@snowbattle/shared";

export const COUNTDOWN_BROADCAST_INTERVAL_MS = 250;

export type StateDispatchMode = "continuous" | "idle" | "transition";

export class DuelRoomMessageCache {
  private readonly payloads = new Map<string, string>();

  clearChannel(channel: string) {
    const prefix = `${channel}::`;

    for (const key of this.payloads.keys()) {
      if (key.startsWith(prefix)) {
        this.payloads.delete(key);
      }
    }
  }

  clearClient(sessionId: string) {
    const suffix = `::${sessionId}`;

    for (const key of this.payloads.keys()) {
      if (key.endsWith(suffix)) {
        this.payloads.delete(key);
      }
    }
  }

  delete(channel: string, sessionId: string) {
    this.payloads.delete(createCacheKey(channel, sessionId));
  }

  shouldSend(
    channel: string,
    sessionId: string,
    payload: unknown,
    force = false
  ) {
    const key = createCacheKey(channel, sessionId);
    const serialized = JSON.stringify(payload);

    if (!force && this.payloads.get(key) === serialized) {
      return false;
    }

    this.payloads.set(key, serialized);
    return true;
  }
}

export function getStateDispatchMode(
  lifecycle: MatchLifecycle,
  previousLifecycle: MatchLifecycle
): StateDispatchMode {
  if (lifecycle === "in_match") {
    return "continuous";
  }

  if (lifecycle === "finished" && previousLifecycle !== "finished") {
    return "transition";
  }

  return "idle";
}

export function quantizeCountdownRemainingMs(remainingMs: number) {
  if (remainingMs <= 0) {
    return 0;
  }

  return (
    Math.ceil(remainingMs / COUNTDOWN_BROADCAST_INTERVAL_MS) *
    COUNTDOWN_BROADCAST_INTERVAL_MS
  );
}

function createCacheKey(channel: string, sessionId: string) {
  return `${channel}::${sessionId}`;
}
