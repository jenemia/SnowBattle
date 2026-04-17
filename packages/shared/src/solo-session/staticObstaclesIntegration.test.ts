import { describe, expect, it } from "vitest";

import {
  STATIC_ARENA_OBSTACLES,
  trySpawnProjectile,
  updatePlayers,
  updateProjectiles,
  updateStructures,
  type SoloRuntimeState
} from "../index.js";
import { createInitialState } from "./createInitialState.js";
import { isBuildPreviewValid } from "./buildRules.js";

describe("static arena obstacles", () => {
  it("stay clear of spawn pads and the central bonfire lane", () => {
    expect(STATIC_ARENA_OBSTACLES).toHaveLength(6);

    for (const obstacle of STATIC_ARENA_OBSTACLES) {
      expect(obstacle.blockingRadius).toBeGreaterThan(obstacle.visualRadius);
      expect(Math.hypot(obstacle.x, obstacle.z)).toBeGreaterThan(5.5);
      expect(Math.hypot(obstacle.x, obstacle.z - 10)).toBeGreaterThan(5.5);
      expect(Math.hypot(obstacle.x, obstacle.z + 10)).toBeGreaterThan(5.5);
    }
  });

  it("blocks build previews on obstacle positions", () => {
    const runtime = createInitialState({ botEnabled: false });
    const player = runtime.players.A;
    const obstacle = STATIC_ARENA_OBSTACLES[0];

    player.pointerActive = true;
    player.aimX = obstacle.x;
    player.aimZ = obstacle.z;

    expect(isBuildPreviewValid(runtime, player, "wall", "standard")).toBe(false);
    expect(isBuildPreviewValid(runtime, player, "snowman_turret", "standard")).toBe(false);
  });

  it("prevents players from walking through static obstacles", () => {
    const runtime = createInitialState({ botEnabled: false });
    const obstacle = STATIC_ARENA_OBSTACLES[0];
    const player = runtime.players.A;

    player.x = obstacle.x - obstacle.blockingRadius - 1.2;
    player.z = obstacle.z;
    player.moveX = 1;
    player.moveZ = 0;

    updatePlayers(runtime, 250, "standard", 22);

    expect(Math.hypot(player.x - obstacle.x, player.z - obstacle.z)).toBeGreaterThanOrEqual(
      obstacle.blockingRadius + 0.9 - 0.01
    );
  });

  it("blocks turret line of sight through a static obstacle", () => {
    const runtime = createInitialRuntimeForObstacleLane();
    const obstacle = STATIC_ARENA_OBSTACLES[0];

    runtime.players.A.aimX = obstacle.x - obstacle.blockingRadius - 1.8;
    runtime.players.A.aimZ = obstacle.z;
    runtime.structures.set("turret-a-1", {
      enabled: true,
      expiresAt: runtime.elapsedMs + 10_000,
      hp: 70,
      id: "turret-a-1",
      nextFireAt: runtime.elapsedMs,
      ownerSlot: "A",
      rotationY: 0,
      type: "snowman_turret",
      x: obstacle.x - obstacle.blockingRadius - 1.8,
      z: obstacle.z
    });
    runtime.players.B.x = obstacle.x + obstacle.blockingRadius + 1.8;
    runtime.players.B.z = obstacle.z;

    updateStructures(runtime, "standard", 22, 0.1);

    expect(runtime.projectiles.size).toBe(0);
  });

  it("destroys projectiles when they hit a static obstacle", () => {
    const runtime = createInitialRuntimeForObstacleLane();
    const obstacle = STATIC_ARENA_OBSTACLES[0];
    const player = runtime.players.A;
    const target = runtime.players.B;

    player.x = obstacle.x - obstacle.blockingRadius - 3;
    player.z = obstacle.z;
    player.aimX = obstacle.x + obstacle.blockingRadius + 3;
    player.aimZ = obstacle.z;
    player.pointerActive = true;
    target.x = obstacle.x + obstacle.blockingRadius + 3;
    target.z = obstacle.z;

    trySpawnProjectile(runtime, player);

    for (let index = 0; index < 8; index += 1) {
      runtime.elapsedMs += 100;
      updateProjectiles(runtime, 0.1);
    }

    expect(runtime.projectiles.size).toBe(0);
    expect(target.hp).toBe(100);
  });
});

function createInitialRuntimeForObstacleLane(): SoloRuntimeState {
  return createInitialState({
    botEnabled: false,
    guestNames: { A: "You", B: "Opponent" }
  });
}
