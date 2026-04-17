import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  SOLO_HEATER_BEACON_HP,
  SOLO_SNOWMAN_TURRET_HP,
  SOLO_WALL_HP,
  type SessionSnapshot
} from "@snowbattle/shared";

import { SoloStructureRenderer } from "./structureRenderer";

describe("SoloStructureRenderer", () => {
  it("keeps every buildable grounded after sync", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloStructureRenderer(scene);

    renderer.sync(
      createSnapshot([
        createWall(),
        createTurret(),
        createHeater()
      ])
    );

    const bounds = scene.children.map((object) => new THREE.Box3().setFromObject(object));

    expect(bounds).toHaveLength(3);
    expect(bounds[0]?.min.y).toBeGreaterThanOrEqual(0.02999);
    expect(bounds[1]?.min.y).toBeGreaterThanOrEqual(0.33999);
    expect(bounds[2]?.min.y).toBeGreaterThanOrEqual(0.02999);
  });

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

    expect(bounds.min.y).toBeCloseTo(0.03, 5);
    expect(bounds.max.y).toBeCloseTo(3.03, 5);
  });

  it("keeps damaged buildables at full height while preserving ground clearance", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloStructureRenderer(scene);

    renderer.sync(
      createSnapshot([
        createWall({ hp: SOLO_WALL_HP * 0.5 }),
        createTurret({ hp: SOLO_SNOWMAN_TURRET_HP * 0.5 }),
        createHeater({ hp: SOLO_HEATER_BEACON_HP * 0.5 })
      ])
    );

    const bounds = scene.children.map((object) => new THREE.Box3().setFromObject(object));

    expect(bounds[0]?.min.y).toBeCloseTo(0.03, 5);
    expect(bounds[0]?.max.y).toBeCloseTo(3.03, 5);
    expect(bounds[1]?.min.y).toBeCloseTo(0.34, 5);
    expect(bounds[1]?.max.y).toBeCloseTo(2.64, 5);
    expect(bounds[2]?.min.y).toBeCloseTo(0.03, 5);
    expect(bounds[2]?.max.y).toBeCloseTo(1.03, 5);
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

function createTurret(
  overrides?: Partial<SessionSnapshot["structures"][number]>
): SessionSnapshot["structures"][number] {
  return {
    enabled: true,
    expiresAt: 10_000,
    hp: SOLO_SNOWMAN_TURRET_HP,
    id: "turret-a-1",
    ownerSlot: "A",
    type: "snowman_turret",
    x: 8,
    z: 4,
    ...overrides
  };
}

function createHeater(
  overrides?: Partial<SessionSnapshot["structures"][number]>
): SessionSnapshot["structures"][number] {
  return {
    enabled: true,
    expiresAt: 10_000,
    hp: SOLO_HEATER_BEACON_HP,
    id: "heater-a-1",
    ownerSlot: "A",
    type: "heater_beacon",
    x: -4,
    z: 3,
    ...overrides
  };
}
