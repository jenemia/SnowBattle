import { describe, expect, it } from "vitest";

import {
  FIRE_COOLDOWN_MS,
  SOLO_FINAL_PUSH_START_MS,
  SOLO_MATCH_DURATION_MS,
  SOLO_WHITEOUT_START_MS
} from "./constants";
import { SoloRulesEngine } from "./soloSession";
import type { SlotId } from "./protocol";

type RuntimeAccess = {
  runtime: {
    centerControlTime: Record<SlotId, number>;
    elapsedMs: number;
    players: Record<
      SlotId,
      {
        hp: number;
        lastHitAt: number | null;
        snowLoad: number;
        totalDirectDamageDealt: number;
        x: number;
        z: number;
      }
    >;
  };
};

describe("SoloRulesEngine", () => {
  it("applies direct-hit damage, snow load, and packed snow reward", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: -10, moveY: -1, pointerActive: true });
    advance(engine, 800);

    setInput(engine, "A", { aimY: -10, moveY: 0, pointerActive: true });
    engine.receiveCommand("A", { type: "action:primary" });
    advance(engine, 1500);

    const snapshot = engine.getSnapshot();
    expect(snapshot.opponentPlayer.hp).toBe(85);
    expect(snapshot.opponentPlayer.snowLoad).toBe(20);
    expect(snapshot.localPlayer.packedSnow).toBe(100);
  });

  it("melts snow load after the grace delay", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: -10, moveY: -1, pointerActive: true });
    advance(engine, 800);

    setInput(engine, "A", { aimY: -10, moveY: 0, pointerActive: true });
    engine.receiveCommand("A", { type: "action:primary" });
    advance(engine, 3000);

    expect(engine.getSnapshot().opponentPlayer.snowLoad).toBeLessThan(20);
  });

  it("despawns projectiles after the fixed range", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: 20, pointerActive: true });
    engine.receiveCommand("A", { type: "action:primary" });
    advance(engine, 1000);

    expect(engine.getSnapshot().projectiles).toHaveLength(0);
  });

  it("transitions from standard to whiteout and final push across the solo timeline", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    advance(engine, SOLO_WHITEOUT_START_MS - 50);
    expect(engine.getSnapshot().match.phase).toBe("standard");

    advance(engine, 50);
    expect(engine.getSnapshot().match.phase).toBe("whiteout");

    advance(engine, SOLO_FINAL_PUSH_START_MS - SOLO_WHITEOUT_START_MS);
    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("final_push");
    expect(snapshot.match.timeRemainingMs).toBe(15_000);
  });

  it("applies whiteout damage to players stranded outside the shrinking ring", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    advance(engine, 160_000);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("whiteout");
    expect(snapshot.match.whiteoutRadius).toBeLessThan(10);
    expect(snapshot.localPlayer.hp).toBeLessThan(100);
    expect(snapshot.opponentPlayer.hp).toBeLessThan(100);
  });

  it("blocks build placements during final push", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: 5, pointerActive: true });
    engine.receiveCommand("A", {
      type: "build:select",
      payload: { buildType: "wall" }
    });

    advance(engine, SOLO_FINAL_PUSH_START_MS);
    engine.receiveCommand("A", { type: "action:primary" });
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("final_push");
    expect(snapshot.hud.buildPreviewValid).toBe(false);
    expect(snapshot.structures).toHaveLength(0);
  });

  it("returns to combat mode after a successful build placement", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: 5, pointerActive: true });
    engine.receiveCommand("A", {
      type: "build:select",
      payload: { buildType: "wall" }
    });

    engine.receiveCommand("A", { type: "action:primary" });
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.structures).toHaveLength(1);
    expect(snapshot.localPlayer.selectedBuild).toBeNull();
  });

  it("awards the center bonfire reward after channeling", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimX: 0, aimY: 0, moveY: -1, pointerActive: true });
    advance(engine, 1250);

    setInput(engine, "A", { aimX: 0, aimY: 0, moveY: 0, pointerActive: true });
    advance(engine, 77_000);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.centerBonfireState).toBe("claimed");
    expect(snapshot.localPlayer.packedSnow).toBe(100);
  });

  it("resolves timeout ties by lower snow load before later tie-breakers", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.elapsedMs = SOLO_MATCH_DURATION_MS - 50;
    runtime.runtime.players.A.x = 0;
    runtime.runtime.players.A.z = 0;
    runtime.runtime.players.B.x = 0;
    runtime.runtime.players.B.z = 0;
    runtime.runtime.players.A.snowLoad = 10;
    runtime.runtime.players.B.snowLoad = 30;
    runtime.runtime.players.A.lastHitAt = runtime.runtime.elapsedMs;
    runtime.runtime.players.B.lastHitAt = runtime.runtime.elapsedMs;

    advance(engine, 50);

    expect(engine.getSnapshot().hud.result).toEqual({
      winnerSlot: "A",
      reason: "timeout"
    });
  });

  it("resolves timeout ties by direct damage after hp and snow load are tied", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.elapsedMs = SOLO_MATCH_DURATION_MS - 50;
    runtime.runtime.players.A.x = 0;
    runtime.runtime.players.A.z = 0;
    runtime.runtime.players.B.x = 0;
    runtime.runtime.players.B.z = 0;
    runtime.runtime.players.A.hp = 70;
    runtime.runtime.players.B.hp = 70;
    runtime.runtime.players.A.snowLoad = 0;
    runtime.runtime.players.B.snowLoad = 0;
    runtime.runtime.players.A.totalDirectDamageDealt = 30;
    runtime.runtime.players.B.totalDirectDamageDealt = 15;

    advance(engine, 50);

    expect(engine.getSnapshot().hud.result).toEqual({
      winnerSlot: "A",
      reason: "timeout"
    });
  });

  it("resolves timeout ties by center control when every earlier metric is tied", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.elapsedMs = SOLO_MATCH_DURATION_MS - 50;
    runtime.runtime.players.A.x = 0;
    runtime.runtime.players.A.z = 0;
    runtime.runtime.players.B.x = 0;
    runtime.runtime.players.B.z = 0;
    runtime.runtime.players.A.hp = 64;
    runtime.runtime.players.B.hp = 64;
    runtime.runtime.players.A.snowLoad = 0;
    runtime.runtime.players.B.snowLoad = 0;
    runtime.runtime.players.A.totalDirectDamageDealt = 15;
    runtime.runtime.players.B.totalDirectDamageDealt = 15;
    runtime.runtime.centerControlTime.A = 2_000;
    runtime.runtime.centerControlTime.B = 500;

    advance(engine, 50);

    expect(engine.getSnapshot().hud.result).toEqual({
      winnerSlot: "A",
      reason: "timeout"
    });
  });

  it("can still finish a timeout round as a draw", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.elapsedMs = SOLO_MATCH_DURATION_MS - FIRE_COOLDOWN_MS;
    runtime.runtime.players.A.x = 0;
    runtime.runtime.players.A.z = 0;
    runtime.runtime.players.B.x = 0;
    runtime.runtime.players.B.z = 0;
    runtime.runtime.players.A.hp = 80;
    runtime.runtime.players.B.hp = 80;
    runtime.runtime.players.A.snowLoad = 0;
    runtime.runtime.players.B.snowLoad = 0;
    runtime.runtime.players.A.totalDirectDamageDealt = 15;
    runtime.runtime.players.B.totalDirectDamageDealt = 15;
    runtime.runtime.centerControlTime.A = 1_000;
    runtime.runtime.centerControlTime.B = 1_000;

    advance(engine, FIRE_COOLDOWN_MS);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("finished");
    expect(snapshot.hud.result).toEqual({
      winnerSlot: null,
      reason: "timeout"
    });
  });
});

function advance(engine: SoloRulesEngine, totalMs: number, stepMs = 50) {
  let remainingMs = totalMs;

  while (remainingMs > 0) {
    const deltaMs = Math.min(stepMs, remainingMs);
    engine.tick(deltaMs);
    remainingMs -= deltaMs;
  }
}

function setInput(
  engine: SoloRulesEngine,
  slot: SlotId,
  {
    aimX = 0,
    aimY = 0,
    moveX = 0,
    moveY = 0,
    pointerActive = false
  }: {
    aimX?: number;
    aimY?: number;
    moveX?: number;
    moveY?: number;
    pointerActive?: boolean;
  }
) {
  engine.receiveCommand(slot, {
    type: "input:update",
    payload: {
      aimX,
      aimY,
      moveX,
      moveY,
      pointerActive
    }
  });
}
