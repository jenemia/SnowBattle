import { describe, expect, it } from "vitest";

import {
  DEFAULT_MATCH_RULES,
  type SessionSnapshot
} from "@snowbattle/shared";

import { getResultOverlayViewModel } from "./resultOverlay";

describe("getResultOverlayViewModel", () => {
  it("uses victory copy for a local win", () => {
    const snapshot = createSnapshot({
      hud: {
        result: {
          reason: "timeout",
          winnerSlot: "A"
        }
      },
      match: {
        phase: "finished"
      }
    });

    expect(getResultOverlayViewModel(snapshot, "solo")).toEqual({
      readout: "Round complete. Queue another local run whenever you want.",
      reason: "Victory · timeout",
      title: "Victory"
    });
  });

  it("uses duel lose copy for a remote win", () => {
    const snapshot = createSnapshot({
      hud: {
        result: {
          reason: "elimination",
          winnerSlot: "B"
        }
      },
      match: {
        phase: "finished"
      }
    });

    expect(getResultOverlayViewModel(snapshot, "duel")).toEqual({
      readout: "Round complete. Requeue when you're ready for another live duel.",
      reason: "Defeat · elimination",
      title: "Defeat"
    });
  });

  it("falls back to a neutral title when the duel lifecycle finished without a winner", () => {
    const snapshot = createSnapshot({
      match: {
        lifecycle: "finished",
        phase: "finished"
      }
    });

    expect(getResultOverlayViewModel(snapshot, "duel")).toEqual({
      readout: "Round complete. Requeue when you're ready for another live duel.",
      reason: "",
      title: "Round complete"
    });
  });
});

type SnapshotOverrides = Partial<
  Omit<SessionSnapshot, "hud" | "localPlayer" | "match" | "opponentPlayer">
> & {
  hud?: Partial<SessionSnapshot["hud"]>;
  localPlayer?: Partial<SessionSnapshot["localPlayer"]>;
  match?: Partial<SessionSnapshot["match"]>;
  opponentPlayer?: Partial<SessionSnapshot["opponentPlayer"]>;
};

function createSnapshot(overrides?: SnapshotOverrides): SessionSnapshot {
  const { hud, localPlayer, match, opponentPlayer, ...rest } = overrides ?? {};

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
      z: 0,
      ...localPlayer
    },
    match: {
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 },
      countdownRemainingMs: 0,
      lifecycle: "finished",
      phase: "finished",
      timeRemainingMs: DEFAULT_MATCH_RULES.matchDurationMs,
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
      z: -10,
      ...opponentPlayer
    },
    projectiles: [],
    structures: [],
    ...rest
  };
}
