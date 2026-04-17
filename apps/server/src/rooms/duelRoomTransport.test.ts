import { describe, expect, it } from "vitest";

import { DuelRoomMessageCache, getStateDispatchMode, quantizeCountdownRemainingMs } from "./duelRoomTransport.js";

describe("duelRoomTransport", () => {
  it("quantizes countdown updates to 250ms steps", () => {
    expect(quantizeCountdownRemainingMs(3_000)).toBe(3_000);
    expect(quantizeCountdownRemainingMs(2_999)).toBe(3_000);
    expect(quantizeCountdownRemainingMs(2_501)).toBe(2_750);
    expect(quantizeCountdownRemainingMs(0)).toBe(0);
  });

  it("only continuously dispatches authoritative state while the duel is live", () => {
    expect(getStateDispatchMode("waiting", "waiting")).toBe("idle");
    expect(getStateDispatchMode("countdown", "waiting")).toBe("idle");
    expect(getStateDispatchMode("in_match", "countdown")).toBe("continuous");
    expect(getStateDispatchMode("finished", "in_match")).toBe("transition");
    expect(getStateDispatchMode("finished", "finished")).toBe("idle");
  });

  it("suppresses duplicate payloads until the channel cache is cleared", () => {
    const cache = new DuelRoomMessageCache();
    const payload = {
      roomId: "room-1",
      status: "queued"
    };

    expect(cache.shouldSend("server:queue_status", "client-a", payload)).toBe(true);
    expect(cache.shouldSend("server:queue_status", "client-a", payload)).toBe(false);

    cache.clearChannel("server:queue_status");

    expect(cache.shouldSend("server:queue_status", "client-a", payload)).toBe(true);
  });
});
