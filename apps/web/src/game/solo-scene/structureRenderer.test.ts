import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { SOLO_WALL_HP, type SessionSnapshot } from "@snowbattle/shared";

import { SoloStructureRenderer } from "./structureRenderer";

describe("SoloStructureRenderer", () => {
  it("keeps wall structures grounded after sync", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloStructureRenderer(scene);

    renderer.sync(
      createSnapshot([
        createWall({
          hp: SOLO_WALL_HP
        })
      ])
    );

    const wall = scene.children[0];
    const bounds = new THREE.Box3().setFromObject(wall);

    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.y).toBeCloseTo(3, 5);
  });

  it("keeps damaged walls grounded while scaling by hp", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloStructureRenderer(scene);

    renderer.sync(
      createSnapshot([
        createWall({
          hp: SOLO_WALL_HP * 0.5
        })
      ])
    );

    const wall = scene.children[0];
    const bounds = new THREE.Box3().setFromObject(wall);

    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.y).toBeCloseTo(1.5, 5);
  });

  it("applies persisted wall rotation during sync", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloStructureRenderer(scene);

    renderer.sync(
      createSnapshot([
        createWall({
          rotationY: Math.PI / 3
        })
      ])
    );

    expect(scene.children[0]?.rotation.y).toBeCloseTo(Math.PI / 3, 5);
  });
});

function createSnapshot(
  structures: SessionSnapshot["structures"]
): SessionSnapshot {
  return {
    hud: {
      activeBonfire: false,
      buildPreviewValid: true,
      cursorX: 0,
      cursorZ: 0,
      pointerActive: false,
      result: null
    },
    localPlayer: {
      buildCooldownRemaining: 0,
      connected: true,
      facingAngle: 0,
      guestName: "You",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: "A",
      snowLoad: 0,
      x: 0,
      z: 0
    },
    match: {
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 },
      countdownRemainingMs: 0,
      lifecycle: "in_match",
      phase: "standard",
      timeRemainingMs: 180_000,
      whiteoutRadius: 22
    },
    opponentPlayer: {
      buildCooldownRemaining: 0,
      connected: true,
      facingAngle: 0,
      guestName: "Opponent",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: "B",
      snowLoad: 0,
      x: 10,
      z: 10
    },
    projectiles: [],
    structures
  };
}

function createWall(
  overrides?: Partial<SessionSnapshot["structures"][number]>
): SessionSnapshot["structures"][number] {
  return {
    enabled: true,
    expiresAt: 10_000,
    hp: SOLO_WALL_HP,
    id: "wall-a-1",
    ownerSlot: "A",
    type: "wall",
    x: 4,
    z: 6,
    ...overrides
  };
}
