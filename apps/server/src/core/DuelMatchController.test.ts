import { describe, expect, it } from "vitest";

import { COUNTDOWN_MS } from "@snowbattle/shared";

import { DuelMatchController } from "./DuelMatchController.js";

describe("DuelMatchController", () => {
  it("returns to waiting when a player leaves before match start", () => {
    const controller = new DuelMatchController("room-1");
    controller.addPlayer({ sessionId: "a", guestName: "Alpha" });
    controller.addPlayer({ sessionId: "b", guestName: "Beta" });
    controller.setReady("a", true);
    controller.setReady("b", true);

    expect(controller.maybeStartCountdown(1_000)).toBe(true);
    expect(controller.lifecycle).toBe("countdown");

    controller.removePlayer("b");

    expect(controller.lifecycle).toBe("waiting");
    expect(controller.getPlayers()).toHaveLength(1);
  });

  it("ends by forfeit when a player leaves mid-match", () => {
    const controller = new DuelMatchController("room-2");
    controller.addPlayer({ sessionId: "a", guestName: "Alpha" });
    controller.addPlayer({ sessionId: "b", guestName: "Beta" });
    controller.setReady("a", true);
    controller.setReady("b", true);
    controller.maybeStartCountdown(1_000);
    controller.tick(COUNTDOWN_MS + 1, 1_000 + COUNTDOWN_MS + 1);

    expect(controller.lifecycle).toBe("in_match");

    controller.removePlayer("b");

    expect(controller.lifecycle).toBe("finished");
    expect(controller.getMatchResult()).toMatchObject({
      reason: "forfeit",
      winnerSlot: "A"
    });
  });
});
