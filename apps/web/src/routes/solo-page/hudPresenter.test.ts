import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import { presentDuelHud, presentSoloHud } from "./hudPresenter";

describe("presentSoloHud", () => {
  it("shares combat telemetry across solo and duel while keeping action copy separate", () => {
    const snapshot = createSnapshot();
    const soloHud = presentSoloHud(snapshot);
    const duelHud = presentDuelHud(snapshot);

    expect(soloHud.statusText).toBe("Combat");
    expect(soloHud.modeText).toBe("Throw ready");
    expect(soloHud.buildText).toBe("combat");
    expect(soloHud.actionDisabled).toBe(true);
    expect(duelHud.statusText).toBe(soloHud.statusText);
    expect(duelHud.modeText).toBe(soloHud.modeText);
    expect(duelHud.timeText).toBe(soloHud.timeText);
    expect(duelHud.cooldownText).toBe(soloHud.cooldownText);
    expect(duelHud.actionText).toBe("Requeue");
    expect(soloHud.actionText).toBe("Restart round");
  });

  it("formats resolved result state for solo and duel surfaces", () => {
    const snapshot =
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
    ;
    const soloHud = presentSoloHud(snapshot);
    const duelHud = presentDuelHud(snapshot);

    expect(soloHud.statusText).toBe("Complete");
    expect(soloHud.resultText).toBe("Victory · timeout");
    expect(soloHud.actionDisabled).toBe(false);
    expect(duelHud.resultText).toBe("Victory · timeout");
    expect(duelHud.actionText).toBe("Requeue");
    expect(duelHud.readoutText).toBe(
      "Round complete. Requeue whenever you want another live duel."
    );
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
