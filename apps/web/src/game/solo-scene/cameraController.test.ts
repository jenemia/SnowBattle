import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import { getCameraRigTargets } from "./cameraController";

describe("getCameraRigTargets", () => {
  it("keeps slot A chased from positive Z and slot B from negative Z", () => {
    const slotATargets = getCameraRigTargets(createSnapshot("A", 8));
    const slotBTargets = getCameraRigTargets(createSnapshot("B", -8));

    expect(slotATargets.position.z).toBe(30);
    expect(slotBTargets.position.z).toBe(-30);
  });

  it("mirrors the look-target Z bias with the local slot", () => {
    const slotASnapshot = createSnapshot("A", 10);
    const slotBSnapshot = createSnapshot("B", -10);
    const slotATargets = getCameraRigTargets(slotASnapshot);
    const slotBTargets = getCameraRigTargets(slotBSnapshot);

    expect(slotATargets.lookTarget.x).toBe(slotASnapshot.localPlayer.x);
    expect(slotBTargets.lookTarget.x).toBe(slotBSnapshot.localPlayer.x);
    expect(slotATargets.lookTarget.z).toBeCloseTo(slotASnapshot.localPlayer.z + 0.4);
    expect(slotBTargets.lookTarget.z).toBeCloseTo(slotBSnapshot.localPlayer.z - 0.4);
  });

  it("does not drift the look target toward the cursor", () => {
    const snapshot = createSnapshot("A", 10);
    snapshot.hud.cursorX = 18;
    snapshot.hud.cursorZ = -14;

    const targets = getCameraRigTargets(snapshot);

    expect(targets.lookTarget.x).toBe(snapshot.localPlayer.x);
    expect(targets.lookTarget.z).toBeCloseTo(snapshot.localPlayer.z + 0.4);
  });
});

function createSnapshot(
  slot: SessionSnapshot["localPlayer"]["slot"],
  z: number
): SessionSnapshot {
  return {
    hud: {
      activeBonfire: false,
      buildPreviewValid: false,
      cursorX: 6,
      cursorZ: z + 3,
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
      slot,
      snowLoad: 0,
      x: 4,
      z
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
      slot: slot === "A" ? "B" : "A",
      snowLoad: 0,
      x: -4,
      z: -z
    },
    projectiles: [],
    structures: []
  };
}
