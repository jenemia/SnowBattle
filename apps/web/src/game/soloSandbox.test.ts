import { describe, expect, it } from "vitest";

import {
  IndexPool,
  intersectRayWithGround,
  isWallPlacementValid,
  stepDurability
} from "./soloSandbox";

describe("solo sandbox helpers", () => {
  it("reuses released indices from the pool", () => {
    const pool = new IndexPool(2);

    const first = pool.acquire();
    const second = pool.acquire();

    expect(first).toBe(0);
    expect(second).toBe(1);
    expect(pool.acquire()).toBeNull();

    pool.release(first!);

    expect(pool.acquire()).toBe(0);
    expect(pool.activeCount).toBe(2);
  });

  it("intersects a camera ray with the ground plane", () => {
    const hit = intersectRayWithGround({
      direction: { x: 1, y: -5, z: 2 },
      origin: { x: 4, y: 10, z: -2 }
    });

    expect(hit).toEqual({ x: 6, z: 2 });
  });

  it("rejects invalid wall placements", () => {
    expect(
      isWallPlacementValid({
        arenaBounds: 20,
        halfDepth: 0.4,
        halfWidth: 1.5,
        playerRadius: 0.9,
        playerX: 0,
        playerZ: 0,
        walls: [],
        x: 0,
        z: 0
      })
    ).toBe(false);

    expect(
      isWallPlacementValid({
        arenaBounds: 20,
        halfDepth: 0.4,
        halfWidth: 1.5,
        playerRadius: 0.9,
        playerX: 0,
        playerZ: 0,
        walls: [{ halfDepth: 0.4, halfWidth: 1.5, x: 5, z: 5 }],
        x: 5.4,
        z: 5
      })
    ).toBe(false);

    expect(
      isWallPlacementValid({
        arenaBounds: 20,
        halfDepth: 0.4,
        halfWidth: 1.5,
        playerRadius: 0.9,
        playerX: 0,
        playerZ: 0,
        walls: [],
        x: 19.5,
        z: 0
      })
    ).toBe(false);
  });

  it("counts down wall durability to destruction", () => {
    let durability = 5;

    for (let hit = 0; hit < 5; hit += 1) {
      durability = stepDurability(durability);
    }

    expect(durability).toBe(0);
  });
});
