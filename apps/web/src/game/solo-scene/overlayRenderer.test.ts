import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import { getWallPreviewYaw, SoloOverlayRenderer } from "./overlayRenderer";

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

    const preview = getVisiblePreview(scene);
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

  it("matches the placed turret silhouette with a grounded body and head preview", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloOverlayRenderer(scene);

    renderer.sync(
      createSnapshot({
        hud: {
          cursorX: 4,
          cursorZ: 1,
          pointerActive: true
        },
        localPlayer: {
          selectedBuild: "snowman_turret"
        }
      })
    );

    const preview = getVisiblePreview(scene);
    const bounds = new THREE.Box3().setFromObject(preview);

    expect(bounds.min.y).toBeCloseTo(0.34, 5);
    expect(bounds.max.y).toBeCloseTo(2.64, 5);
  });

  it("scales the whiteout ring down to the new 5-unit final radius", () => {
    const scene = new THREE.Scene();
    const renderer = new SoloOverlayRenderer(scene);

    renderer.sync(
      createSnapshot({
        match: {
          phase: "final_push",
          whiteoutRadius: 5
        }
      })
    );

    const whiteoutRing = scene.children.find((child) => {
      return (
        child instanceof THREE.Mesh &&
        child.geometry instanceof THREE.RingGeometry &&
        child.position.y === 0.04
      );
    });

    expect(whiteoutRing).toBeInstanceOf(THREE.Mesh);
    expect(whiteoutRing?.visible).toBe(true);
    expect(whiteoutRing?.scale.x).toBeCloseTo(5, 5);
  });
});

function createSnapshot(
  overrides?: {
    hud?: Partial<SessionSnapshot["hud"]>;
    localPlayer?: Partial<SessionSnapshot["localPlayer"]>;
    match?: Partial<SessionSnapshot["match"]>;
  }
): SessionSnapshot {
  const { hud, localPlayer, match } = overrides ?? {};

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
      timeRemainingMs: 120_000,
      whiteoutRadius: 22,
      ...match
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

function getVisiblePreview(scene: THREE.Scene) {
  const preview = scene.children.find(
    (child) => child.visible && child !== scene.children[0]
  );

  if (!preview) {
    throw new Error("Expected a visible build preview");
  }

  return preview;
}
