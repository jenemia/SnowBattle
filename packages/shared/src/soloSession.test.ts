import { describe, expect, it } from "vitest";

import {
  FIRE_COOLDOWN_MS,
  SOLO_SNOWMAN_TURRET_INTERVAL_MS,
  SOLO_SNOWMAN_TURRET_RANGE
} from "./constants.js";
import {
  DEFAULT_MATCH_RULES,
  createMatchRules
} from "./matchRules.js";
import { getWallStructureRotationY } from "./solo-session/buildRules.js";
import { SoloRulesEngine } from "./soloSession.js";
import type { SlotId } from "./protocol.js";

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
    engine.receiveCommand("A", actionPrimary());
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
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 3000);

    expect(engine.getSnapshot().opponentPlayer.snowLoad).toBeLessThan(20);
  });

  it("despawns projectiles after the fixed range", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: 20, pointerActive: true });
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 1000);

    expect(engine.getSnapshot().projectiles).toHaveLength(0);
  });

  it("transitions from standard to whiteout and final push across the solo timeline", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    keepPlayersInsideSafeZone(engine);

    advance(engine, DEFAULT_MATCH_RULES.whiteoutStartMs - 50);
    expect(engine.getSnapshot().match.phase).toBe("standard");

    advance(engine, 50);
    expect(engine.getSnapshot().match.phase).toBe("whiteout");

    advance(
      engine,
      DEFAULT_MATCH_RULES.finalPushStartMs - DEFAULT_MATCH_RULES.whiteoutStartMs
    );
    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("final_push");
    expect(snapshot.match.timeRemainingMs).toBe(
      DEFAULT_MATCH_RULES.matchDurationMs - DEFAULT_MATCH_RULES.finalPushStartMs
    );
  });

  it("applies whiteout damage to players stranded outside the shrinking ring", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    advance(engine, 85_000);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("whiteout");
    expect(snapshot.match.whiteoutRadius).toBeLessThan(10);
    expect(snapshot.localPlayer.hp).toBeLessThan(100);
    expect(snapshot.opponentPlayer.hp).toBeLessThan(100);
  });

  it("holds the whiteout ring at radius 5 once final push begins", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    keepPlayersInsideSafeZone(engine);

    advance(engine, DEFAULT_MATCH_RULES.finalPushStartMs);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("final_push");
    expect(snapshot.match.whiteoutRadius).toBe(DEFAULT_MATCH_RULES.whiteoutTargetRadius);
    expect(snapshot.match.timeRemainingMs).toBe(
      DEFAULT_MATCH_RULES.matchDurationMs - DEFAULT_MATCH_RULES.finalPushStartMs
    );
  });

  it("blocks build placements during final push", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    keepPlayersInsideSafeZone(engine);

    setInput(engine, "A", { aimY: 5, pointerActive: true });
    engine.receiveCommand("A", buildSelect("wall"));

    advance(engine, DEFAULT_MATCH_RULES.finalPushStartMs);
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("final_push");
    expect(snapshot.hud.buildPreviewValid).toBe(false);
    expect(snapshot.structures).toHaveLength(0);
  });

  it("returns to combat mode after a successful build placement", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: 5, pointerActive: true });
    engine.receiveCommand("A", buildSelect("wall"));

    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.structures).toHaveLength(1);
    expect(snapshot.localPlayer.selectedBuild).toBeNull();
  });

  it("marks a successful build with a short build action signal", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: 5, pointerActive: true });
    engine.receiveCommand("A", buildSelect("heater_beacon"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.localPlayer.action).toBe("build");
    expect(snapshot.localPlayer.actionRemainingMs).toBeGreaterThan(0);
  });

  it("allows walls to place at the extended wall-only build range", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimX: 0, aimY: -2, pointerActive: true });
    engine.receiveCommand("A", buildSelect("wall"));

    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.structures).toHaveLength(1);
    expect(snapshot.structures[0]?.type).toBe("wall");
  });

  it("keeps turret placement on the original shorter build range", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimX: 0, aimY: -2, pointerActive: true });
    engine.receiveCommand("A", buildSelect("snowman_turret"));

    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.hud.buildPreviewValid).toBe(false);
    expect(snapshot.structures).toHaveLength(0);
  });

  it("preserves wall preview rotation on placement", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimX: 4, aimY: 4.5, pointerActive: true });
    engine.receiveCommand("A", buildSelect("wall"));

    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const snapshot = engine.getSnapshot();
    const wall = snapshot.structures[0];

    expect(wall).toBeDefined();
    expect(wall?.rotationY).toBeCloseTo(
      getWallStructureRotationY(
        snapshot.localPlayer.x,
        snapshot.localPlayer.z,
        wall!.x,
        wall!.z
      ),
      5
    );
  });

  it("pushes nearby players out of a newly placed wall", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.players.A.x = 4;
    runtime.runtime.players.A.z = 8;
    runtime.runtime.players.B.x = 6;
    runtime.runtime.players.B.z = 5;

    setInput(engine, "A", { aimX: 4, aimY: 4.5, pointerActive: true });
    engine.receiveCommand("A", buildSelect("wall"));

    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const snapshot = engine.getSnapshot();

    expect(snapshot.structures).toHaveLength(1);
    expect(snapshot.opponentPlayer.x).toBeCloseTo(6, 5);
    expect(snapshot.opponentPlayer.z).toBeCloseTo(6.05, 5);
  });

  it("spawns visible turret projectiles before applying snow load", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess & {
      runtime: RuntimeAccess["runtime"] & {
        players: RuntimeAccess["runtime"]["players"];
      };
    };

    runtime.runtime.players.B.x = 3;
    runtime.runtime.players.B.z = -3;

    setInput(engine, "A", { aimX: 3, aimY: 4, pointerActive: true });
    engine.receiveCommand("A", buildSelect("snowman_turret"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 2_550);

    const firingSnapshot = engine.getSnapshot();

    expect(firingSnapshot.structures).toHaveLength(1);
    expect(firingSnapshot.projectiles).toHaveLength(1);
    expect(firingSnapshot.projectiles[0]?.sourceType).toBe("snowman_turret");

    advance(engine, 250);

    const travelSnapshot = engine.getSnapshot();
    expect(travelSnapshot.projectiles).toHaveLength(1);
    expect(travelSnapshot.opponentPlayer.snowLoad).toBe(0);

    advance(engine, 250);

    const hitSnapshot = engine.getSnapshot();
    expect(hitSnapshot.projectiles).toHaveLength(0);
    expect(hitSnapshot.opponentPlayer.snowLoad).toBeGreaterThan(0);
  });

  it("publishes a throw action signal when the player launches a snowball", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    setInput(engine, "A", { aimY: -10, pointerActive: true });
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 1, 1);

    const snapshot = engine.getSnapshot();
    expect(snapshot.localPlayer.action).toBe("throw");
    expect(snapshot.localPlayer.actionRemainingMs).toBeGreaterThan(0);
  });

  it("fires at the target position captured at shot time instead of homing after launch", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess & {
      runtime: RuntimeAccess["runtime"] & {
        players: RuntimeAccess["runtime"]["players"];
      };
    };

    runtime.runtime.players.A.x = 0;
    runtime.runtime.players.A.z = 0;
    runtime.runtime.players.B.x = 0;
    runtime.runtime.players.B.z = -12;

    setInput(engine, "A", { aimX: 0, aimY: -2, pointerActive: true });
    engine.receiveCommand("A", buildSelect("snowman_turret"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, SOLO_SNOWMAN_TURRET_INTERVAL_MS + 50);

    const firedSnapshot = engine.getSnapshot();
    expect(firedSnapshot.projectiles).toHaveLength(1);

    runtime.runtime.players.B.x = 8;
    runtime.runtime.players.B.z = -12;

    advance(engine, 750);

    const travelSnapshot = engine.getSnapshot();
    expect(travelSnapshot.projectiles).toHaveLength(1);
    expect(travelSnapshot.projectiles[0]?.x).toBeCloseTo(0, 3);
    expect(travelSnapshot.opponentPlayer.snowLoad).toBe(0);

    advance(engine, 1_500);

    const resolvedSnapshot = engine.getSnapshot();
    expect(resolvedSnapshot.projectiles).toHaveLength(0);
    expect(resolvedSnapshot.opponentPlayer.snowLoad).toBe(0);
  });

  it("does not auto-fire turrets when the enemy is outside turret range", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.players.B.x = SOLO_SNOWMAN_TURRET_RANGE;
    runtime.runtime.players.B.z = SOLO_SNOWMAN_TURRET_RANGE;

    setInput(engine, "A", { aimX: 3, aimY: 4, pointerActive: true });
    engine.receiveCommand("A", buildSelect("snowman_turret"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, SOLO_SNOWMAN_TURRET_INTERVAL_MS + 50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.structures).toHaveLength(1);
    expect(snapshot.projectiles).toHaveLength(0);
  });

  it("can hit enemies beyond player snowball range while staying inside turret range", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.players.B.x = 3;
    runtime.runtime.players.B.z = -15;

    setInput(engine, "A", { aimX: 3, aimY: 4, pointerActive: true });
    engine.receiveCommand("A", buildSelect("snowman_turret"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, SOLO_SNOWMAN_TURRET_INTERVAL_MS + 2_000);

    const snapshot = engine.getSnapshot();
    expect(snapshot.opponentPlayer.snowLoad).toBeGreaterThan(0);
    expect(snapshot.projectiles).toHaveLength(0);
  });

  it("does not auto-fire turrets through walls", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.players.A.x = 0;
    runtime.runtime.players.A.z = 0;
    runtime.runtime.players.B.x = 0;
    runtime.runtime.players.B.z = -8;

    setInput(engine, "A", { aimX: 0, aimY: -2, pointerActive: true });
    engine.receiveCommand("A", buildSelect("snowman_turret"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 800);

    setInput(engine, "A", { aimX: 0, aimY: -6.5, pointerActive: true });
    engine.receiveCommand("A", buildSelect("wall"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, SOLO_SNOWMAN_TURRET_INTERVAL_MS + 100);

    const snapshot = engine.getSnapshot();
    expect(snapshot.structures).toHaveLength(2);
    expect(snapshot.projectiles).toHaveLength(0);
  });

  it("updates turret aimRotationY toward a valid target before firing", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });
    const runtime = engine as unknown as RuntimeAccess;

    runtime.runtime.players.B.x = 6;
    runtime.runtime.players.B.z = 4;

    setInput(engine, "A", { aimX: 3, aimY: 4, pointerActive: true });
    engine.receiveCommand("A", buildSelect("snowman_turret"));
    engine.receiveCommand("A", actionPrimary());
    advance(engine, 50);

    const turret = engine.getSnapshot().structures[0];
    expect(turret?.type).toBe("snowman_turret");
    expect(turret?.aimRotationY).toBeCloseTo(Math.atan2(3, 0), 5);
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

    runtime.runtime.elapsedMs = DEFAULT_MATCH_RULES.matchDurationMs - 50;
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

    runtime.runtime.elapsedMs = DEFAULT_MATCH_RULES.matchDurationMs - 50;
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

    runtime.runtime.elapsedMs = DEFAULT_MATCH_RULES.matchDurationMs - 50;
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

    runtime.runtime.elapsedMs = DEFAULT_MATCH_RULES.matchDurationMs - FIRE_COOLDOWN_MS;
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

  it("supports custom match rules through the engine options", () => {
    const rules = createMatchRules({
      finalPushStartMs: 55_000,
      matchDurationMs: 75_000,
      whiteoutStartMs: 30_000,
      whiteoutTargetRadius: 7
    });
    const engine = new SoloRulesEngine({
      botEnabled: false,
      rules
    });

    advance(engine, rules.whiteoutStartMs);
    expect(engine.getSnapshot().match.phase).toBe("whiteout");

    advance(engine, rules.finalPushStartMs - rules.whiteoutStartMs);
    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("final_push");
    expect(snapshot.match.whiteoutRadius).toBe(rules.whiteoutTargetRadius);
    expect(snapshot.match.timeRemainingMs).toBe(
      rules.matchDurationMs - rules.finalPushStartMs
    );
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

function keepPlayersInsideSafeZone(engine: SoloRulesEngine) {
  const runtime = engine as unknown as RuntimeAccess;

  runtime.runtime.players.A.x = 0;
  runtime.runtime.players.A.z = 0;
  runtime.runtime.players.B.x = 0;
  runtime.runtime.players.B.z = 0;
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
  engine.receiveCommand(slot, inputUpdate({
    aimX,
    aimY,
    moveX,
    moveY,
    pointerActive
  }));
}

let nextInputSeq = 1;

function actionPrimary() {
  return {
    inputSeq: nextInputSeq++,
    type: "action:primary" as const
  };
}

function buildSelect(buildType: "wall" | "snowman_turret" | "heater_beacon") {
  return {
    inputSeq: nextInputSeq++,
    payload: { buildType },
    type: "build:select" as const
  };
}

function inputUpdate(payload: {
  aimX: number;
  aimY: number;
  moveX: number;
  moveY: number;
  pointerActive: boolean;
}) {
  return {
    inputSeq: nextInputSeq++,
    payload,
    sentAtClientTime: nextInputSeq,
    type: "input:update" as const
  };
}
