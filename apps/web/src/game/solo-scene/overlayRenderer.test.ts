import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import {
  getBuildPreviewCenterY,
  getWallPreviewYaw,
  SoloOverlayRenderer
} from "./overlayRenderer";

describe("SoloOverlayRenderer", () => {
  it("computes wall preview yaw so the preview faces the local player", () => {
    const snapshot = createSnapshot({
      hud: {
        cursorX: 8,
        cursorZ: 3,
        pointerActive: true
      },
      localPlayer: {
        selectedBuild: "wall",
        x: 2,
        z: -5
      }
    });

    expect(getWallPreviewYaw(snapshot)).toBeCloseTo(
      Math.atan2(-6, -8),
      5
    );
  });

  it("resets preview rotation when switching away from wall", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloOverlayRenderer(scene);

    renderer.sync(
      createSnapshot({
        hud: {
          cursorX: 8,
          cursorZ: 3,
          pointerActive: true
        },
        localPlayer: {
          selectedBuild: "wall",
          x: 2,
          z: -5
        }
      })
    );

    const preview = scene.children[1];
    expect(preview.rotation.y).not.toBe(0);

    renderer.sync(
      createSnapshot({
        hud: {
          cursorX: 8,
          cursorZ: 3,
          pointerActive: true
        },
        localPlayer: {
          selectedBuild: "snowman_turret",
          x: 2,
          z: -5
        }
      })
    );

    expect(preview.rotation.y).toBe(0);
  });

  it("aligns build preview height with the grounded placement anchors", () => {
    expect(getBuildPreviewCenterY("wall")).toBeCloseTo(1.53, 5);
    expect(getBuildPreviewCenterY("snowman_turret")).toBeCloseTo(1.54, 5);
    expect(getBuildPreviewCenterY("heater_beacon")).toBeCloseTo(0.63, 5);
  });
});

function createSnapshot(
  overrides?: {
    hud?: Partial<SessionSnapshot["hud"]>;
    localPlayer?: Partial<SessionSnapshot["localPlayer"]>;
  }
): SessionSnapshot {
  const { hud, localPlayer } = overrides ?? {};

  return {
    hud: {
      activeBonfire: false,
      buildPreviewValid: true,
      cursorX: 0,
      cursorZ: 0,
      pointerActive: false,
      result: null,
      ...hud
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
      z: 0,
      ...localPlayer
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
    structures: []
  };
}
