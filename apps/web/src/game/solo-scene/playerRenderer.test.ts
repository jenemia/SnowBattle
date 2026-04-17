import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import { SoloPlayerRenderer } from "./playerRenderer";

describe("SoloPlayerRenderer", () => {
  it("smooths player movement instead of snapping to the next snapshot", () => {
    const scene = new THREE.Scene();
    const clock = { elapsedTime: 0 } as THREE.Clock;
    const renderer = new SoloPlayerRenderer(scene, clock);

    renderer.sync(createSnapshot(0, 10), 1);
    const localRunner = scene.children[0] as THREE.Group;

    expect(localRunner.position.x).toBe(0);
    expect(localRunner.position.z).toBe(10);

    renderer.sync(createSnapshot(8, 6), 1 / 60);

    expect(localRunner.position.x).toBeGreaterThan(0);
    expect(localRunner.position.x).toBeLessThan(8);
    expect(localRunner.position.z).toBeLessThan(10);
    expect(localRunner.position.z).toBeGreaterThan(6);
  });

  it("renders snow buildup near the feet instead of above the head", () => {
    const scene = new THREE.Scene();
    const clock = { elapsedTime: 0 } as THREE.Clock;
    const renderer = new SoloPlayerRenderer(scene, clock);

    renderer.sync(createSnapshot(0, 10, 60), 1);

    const localRunner = scene.children[0] as THREE.Group;
    const snowDrift = localRunner.children[2] as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(snowDrift);

    expect(snowDrift.visible).toBe(true);
    expect(bounds.min.y).toBeLessThan(0.4);
    expect(bounds.max.y).toBeLessThan(1.2);
    expect(snowDrift.position.y).toBeLessThan(0.5);
    expect(snowDrift.scale.x).toBeGreaterThan(snowDrift.scale.y);
  });
});

function createSnapshot(x: number, z: number, snowLoad = 0): SessionSnapshot {
  return {
    hud: {
      activeBonfire: false,
      buildPreviewValid: true,
      cursorX: x,
      cursorZ: z - 3,
      pointerActive: true,
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
      snowLoad,
      x,
      z
    },
    match: {
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 },
      countdownRemainingMs: 0,
      lifecycle: "in_match",
      phase: "standard",
      timeRemainingMs: 120_000,
      whiteoutRadius: 22
    },
    opponentPlayer: {
      buildCooldownRemaining: 0,
      connected: true,
      facingAngle: Math.PI,
      guestName: "Opponent",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: "B",
      snowLoad: 0,
      x: -6,
      z: -8
    },
    projectiles: [],
    structures: []
  };
}
