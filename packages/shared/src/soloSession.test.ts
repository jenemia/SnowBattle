import { describe, expect, it } from "vitest";

import { FIRE_COOLDOWN_MS, MATCH_DURATION_MS } from "./constants";
import { SoloRulesEngine } from "./soloSession";

describe("SoloRulesEngine", () => {
  it("applies direct-hit damage, snow load, and packed snow reward", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: -10,
        moveX: 0,
        moveY: -1,
        pointerActive: true
      }
    });

    for (let step = 0; step < 16; step += 1) {
      engine.tick(50);
    }

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: -10,
        moveX: 0,
        moveY: 0,
        pointerActive: true
      }
    });
    engine.receiveCommand("A", { type: "action:primary" });

    for (let step = 0; step < 30; step += 1) {
      engine.tick(50);
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.opponentPlayer.hp).toBe(85);
    expect(snapshot.opponentPlayer.snowLoad).toBe(20);
    expect(snapshot.localPlayer.packedSnow).toBe(100);
  });

  it("melts snow load after the grace delay", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: -10,
        moveX: 0,
        moveY: -1,
        pointerActive: true
      }
    });

    for (let step = 0; step < 16; step += 1) {
      engine.tick(50);
    }

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: -10,
        moveX: 0,
        moveY: 0,
        pointerActive: true
      }
    });
    engine.receiveCommand("A", { type: "action:primary" });

    for (let step = 0; step < 30; step += 1) {
      engine.tick(50);
    }

    for (let step = 0; step < 30; step += 1) {
      engine.tick(50);
    }

    const afterDelay = engine.getSnapshot();
    expect(afterDelay.opponentPlayer.snowLoad).toBeLessThan(20);
  });

  it("despawns projectiles after the fixed range", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: 20,
        moveX: 0,
        moveY: 0,
        pointerActive: true
      }
    });
    engine.receiveCommand("A", { type: "action:primary" });

    for (let step = 0; step < 20; step += 1) {
      engine.tick(50);
    }

    expect(engine.getSnapshot().projectiles).toHaveLength(0);
  });

  it("finishes a timeout round deterministically", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    engine.tick(MATCH_DURATION_MS + FIRE_COOLDOWN_MS);

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.phase).toBe("finished");
    expect(snapshot.hud.result).toEqual({
      winnerSlot: null,
      reason: "timeout"
    });
  });

  it("places limited structures and spends packed snow", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: 5,
        moveX: 0,
        moveY: 0,
        pointerActive: true
      }
    });
    engine.receiveCommand("A", {
      type: "build:select",
      payload: { buildType: "wall" }
    });
    engine.receiveCommand("A", { type: "action:primary" });
    engine.tick(50);

    const snapshot = engine.getSnapshot();
    expect(snapshot.structures).toHaveLength(1);
    expect(snapshot.structures[0]?.type).toBe("wall");
    expect(snapshot.localPlayer.packedSnow).toBeLessThan(100);
  });

  it("awards the center bonfire reward after channeling", () => {
    const engine = new SoloRulesEngine({ botEnabled: false });

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: 0,
        moveX: 0,
        moveY: -1,
        pointerActive: true
      }
    });

    for (let step = 0; step < 25; step += 1) {
      engine.tick(50);
    }

    engine.receiveCommand("A", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: 0,
        moveX: 0,
        moveY: 0,
        pointerActive: true
      }
    });

    for (let step = 0; step < 1_540; step += 1) {
      engine.tick(50);
    }

    const snapshot = engine.getSnapshot();
    expect(snapshot.match.centerBonfireState).toBe("claimed");
    expect(snapshot.localPlayer.packedSnow).toBe(100);
  });
});
