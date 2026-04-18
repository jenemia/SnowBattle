import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MATCH_RULES,
  type SessionSnapshot
} from "@snowbattle/shared";

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
    const snowDrift = localRunner.children.find(
      (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry
    ) as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(snowDrift);

    expect(snowDrift.visible).toBe(true);
    expect(bounds.min.y).toBeLessThan(0.4);
    expect(bounds.max.y).toBeLessThan(1.2);
    expect(snowDrift.position.y).toBeLessThan(0.5);
    expect(snowDrift.scale.x).toBeGreaterThan(snowDrift.scale.y);
  });

  it("loads a blocky character, keeps the team ring, and switches to walk motion", async () => {
    const scene = new THREE.Scene();
    const clock = { elapsedTime: 0 } as THREE.Clock;
    const loadCharacterInstance = vi.fn(async () => ({
      animations: [
        new THREE.AnimationClip("idle", -1, []),
        new THREE.AnimationClip("walk", -1, []),
        new THREE.AnimationClip("holding-right-shoot", -1, []),
        new THREE.AnimationClip("interact-right", -1, []),
        new THREE.AnimationClip("die", -1, [])
      ],
      root: createMockCharacterRoot()
    }));
    const renderer = new SoloPlayerRenderer(scene, clock, {
      loadCharacterInstance
    });

    renderer.sync(createSnapshot(0, 10), 1);
    await Promise.resolve();
    await Promise.resolve();
    renderer.sync(createSnapshot(2, 8), 1 / 60);

    const internals = renderer as unknown as {
      playerMeshes: Map<
        string,
        {
          actions: Partial<Record<"idle" | "walk", THREE.AnimationAction>>;
          activeCharacterId: string | null;
          currentMotion: "idle" | "walk" | null;
          group: THREE.Group;
        }
      >;
    };
    const localRunner = internals.playerMeshes.get("A");

    expect(loadCharacterInstance).toHaveBeenCalledTimes(2);
    expect(localRunner?.activeCharacterId).toBeTruthy();
    expect(localRunner?.currentMotion).toBe("walk");
    expect(
      localRunner?.group.children.some(
        (child) => child instanceof THREE.Mesh && child.name === "player-local-team-ring"
      )
    ).toBe(true);
    expect(localRunner?.actions.idle).toBeTruthy();
    expect(localRunner?.actions.walk).toBeTruthy();
    expect(
      localRunner?.group.children.some(
        (child) =>
          child instanceof THREE.Group &&
          child.name === `player-${localRunner.activeCharacterId}`
      )
    ).toBe(true);
  });

  it("prefers action clips over locomotion and falls back after the timer ends", async () => {
    const scene = new THREE.Scene();
    const clock = { elapsedTime: 0 } as THREE.Clock;
    const renderer = new SoloPlayerRenderer(scene, clock, {
      loadCharacterInstance: async () => ({
        animations: [
          new THREE.AnimationClip("idle", -1, []),
          new THREE.AnimationClip("walk", -1, []),
          new THREE.AnimationClip("holding-right-shoot", -1, []),
          new THREE.AnimationClip("interact-right", -1, []),
          new THREE.AnimationClip("die", -1, [])
        ],
        root: createMockCharacterRoot()
      })
    });

    renderer.sync(createSnapshot(0, 10), 1);
    await Promise.resolve();
    await Promise.resolve();
    renderer.sync(
      createSnapshot(2, 8, 0, {
        action: "throw",
        actionRemainingMs: 300
      }),
      1 / 60
    );

    const internals = renderer as unknown as {
      playerMeshes: Map<
        string,
        {
          currentMotion: string | null;
        }
      >;
    };

    expect(internals.playerMeshes.get("A")?.currentMotion).toBe("holding-right-shoot");

    renderer.sync(
      createSnapshot(3, 6, 0, {
        action: "none",
        actionRemainingMs: 0
      }),
      1 / 60
    );

    expect(internals.playerMeshes.get("A")?.currentMotion).toBe("walk");
  });
});

function createMockCharacterRoot() {
  const root = new THREE.Group();
  root.name = "mock-blocky-character";
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.5),
    new THREE.MeshStandardMaterial({ color: "#ffffff" })
  );
  torso.position.y = 1.2;
  root.add(torso);
  return root;
}

function createSnapshot(
  x: number,
  z: number,
  snowLoad = 0,
  playerOverrides: Partial<SessionSnapshot["localPlayer"]> = {}
): SessionSnapshot {
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
      action: "none",
      actionRemainingMs: 0,
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
      z,
      ...playerOverrides
    },
    match: {
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 },
      countdownRemainingMs: 0,
      lifecycle: "in_match",
      phase: "standard",
      timeRemainingMs: DEFAULT_MATCH_RULES.matchDurationMs,
      whiteoutRadius: 22
    },
    opponentPlayer: {
      action: "none",
      actionRemainingMs: 0,
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
