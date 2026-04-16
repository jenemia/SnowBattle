import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import { presentSoloHud } from "./hudPresenter";

describe("presentSoloHud", () => {
  it("formats combat state for the HUD", () => {
    const hud = presentSoloHud(createSnapshot());

    expect(hud.statusText).toBe("Combat");
    expect(hud.modeText).toBe("Throw ready");
    expect(hud.buildText).toBe("combat");
    expect(hud.resetDisabled).toBe(true);
  });

  it("formats resolved result state for the HUD", () => {
    const hud = presentSoloHud(
      createSnapshot({
        hud: {
          result: {
            reason: "timeout",
            winnerSlot: "A"
          }
        },
        match: {
          phase: "finished"
        }
      })
    );

    expect(hud.statusText).toBe("Complete");
    expect(hud.resultText).toBe("Victory · timeout");
    expect(hud.resetDisabled).toBe(false);
  });
});

function createSnapshot(
  overrides?: Omit<Partial<SessionSnapshot>, "hud" | "match"> & {
    hud?: Partial<SessionSnapshot["hud"]>;
    match?: Partial<SessionSnapshot["match"]>;
  }
): SessionSnapshot {
  const { hud, match, ...rest } = overrides ?? {};

  return {
    hud: {
      activeBonfire: false,
      buildPreviewValid: false,
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
      z: 0
    },
    match: {
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 },
      countdownRemainingMs: 0,
      lifecycle: "in_match",
      phase: "standard",
      timeRemainingMs: 180_000,
      whiteoutRadius: 22,
      ...match
    },
    opponentPlayer: {
      buildCooldownRemaining: 0,
      connected: true,
      facingAngle: 0,
      guestName: "Bot",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: "B",
      snowLoad: 0,
      x: 0,
      z: -10
    },
    projectiles: [],
    structures: [],
    ...rest
  };
}
