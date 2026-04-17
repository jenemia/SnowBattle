import { describe, expect, it, vi } from "vitest";

import { COUNTDOWN_MS, SoloRulesEngine } from "@snowbattle/shared";

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

  it("returns a localised shared snapshot when the match is active", () => {
    const controller = new DuelMatchController("room-3");
    controller.addPlayer({ sessionId: "a", guestName: "Alpha" });
    controller.addPlayer({ sessionId: "b", guestName: "Beta" });
    controller.setReady("a", true);
    controller.setReady("b", true);
    controller.maybeStartCountdown(1_000);
    controller.tick(COUNTDOWN_MS + 1, 1_000 + COUNTDOWN_MS + 1);

    const snapshot = controller.getSnapshotFor("a");

    expect(snapshot).not.toBeNull();
    expect(snapshot?.localPlayer.guestName).toBe("Alpha");
    expect(snapshot?.opponentPlayer.guestName).toBe("Beta");
    expect(snapshot?.match.lifecycle).toBe("in_match");
  });

  it("caches localised snapshots until the controller state changes", () => {
    const getSnapshotForSpy = vi.spyOn(SoloRulesEngine.prototype, "getSnapshotFor");
    const controller = new DuelMatchController("room-4");
    controller.addPlayer({ sessionId: "a", guestName: "Alpha" });
    controller.addPlayer({ sessionId: "b", guestName: "Beta" });
    controller.setReady("a", true);
    controller.setReady("b", true);
    controller.maybeStartCountdown(1_000);
    controller.tick(COUNTDOWN_MS + 1, 1_000 + COUNTDOWN_MS + 1);

    controller.getSnapshotFor("a");
    controller.getSnapshotFor("a");
    controller.getSnapshotFor("b");
    controller.getSnapshotFor("b");

    expect(getSnapshotForSpy).toHaveBeenCalledTimes(2);

    controller.tick(50, 1_000 + COUNTDOWN_MS + 51);
    controller.getSnapshotFor("a");
    controller.getSnapshotFor("b");

    expect(getSnapshotForSpy).toHaveBeenCalledTimes(4);
  });

  it("acks the latest processed input sequence after applying queued commands", () => {
    const controller = new DuelMatchController("room-5");
    controller.addPlayer({ sessionId: "a", guestName: "Alpha" });
    controller.addPlayer({ sessionId: "b", guestName: "Beta" });
    controller.setReady("a", true);
    controller.setReady("b", true);
    controller.maybeStartCountdown(1_000);
    controller.tick(COUNTDOWN_MS + 1, 1_000 + COUNTDOWN_MS + 1);

    controller.receiveCommand("a", {
      inputSeq: 1,
      payload: {
        aimX: 0,
        aimY: 5,
        moveX: 0,
        moveY: 0,
        pointerActive: true
      },
      sentAtClientTime: 1,
      type: "input:update"
    });
    controller.receiveCommand("a", {
      inputSeq: 2,
      payload: { buildType: "wall" },
      type: "build:select"
    });
    controller.receiveCommand("a", {
      inputSeq: 3,
      type: "action:primary"
    });

    controller.tick(50, 1_000 + COUNTDOWN_MS + 51);

    expect(controller.getAckInputSeq("a")).toBe(3);
    expect(controller.getSnapshotFor("a")?.structures).toHaveLength(1);
  });

  it("can start a duel with custom match rules", () => {
    const customRules = {
      finalPushStartMs: 55_000,
      matchDurationMs: 75_000,
      whiteoutStartMs: 30_000
    };
    const controller = new DuelMatchController("room-6", {
      rules: customRules
    });
    controller.addPlayer({ sessionId: "a", guestName: "Alpha" });
    controller.addPlayer({ sessionId: "b", guestName: "Beta" });
    controller.setReady("a", true);
    controller.setReady("b", true);
    controller.maybeStartCountdown(1_000);
    controller.tick(COUNTDOWN_MS + 1, 1_000 + COUNTDOWN_MS + 1);
    controller.tick(30_000, 1_000 + COUNTDOWN_MS + 1 + 30_000);

    const snapshot = controller.getSnapshotFor("a");

    expect(snapshot?.match.phase).toBe("whiteout");
    expect(snapshot?.match.timeRemainingMs).toBe(
      customRules.matchDurationMs - customRules.whiteoutStartMs
    );
  });
});
