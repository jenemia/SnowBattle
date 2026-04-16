import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import {
  presentDuelHud,
  presentDuelSkillStrip,
  presentSoloHud
} from "./hudPresenter";

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

  it("formats the compact duel skill strip with shared cooldown and remaining slots", () => {
    const strip = presentDuelSkillStrip(
      createSnapshot({
        localPlayer: {
          buildCooldownRemaining: 375,
          slot: "A"
        },
        structures: [
          createStructure("wall", "A", "wall-a-1"),
          createStructure("snowman_turret", "A", "turret-a-1"),
          createStructure("heater_beacon", "B", "heater-b-1")
        ]
      })
    );

    expect(strip.cooldownText).toBe("0.38s");
    expect(strip.wallText).toBe("Wall 1");
    expect(strip.snowmanTurretText).toBe("Turret 0");
    expect(strip.heaterBeaconText).toBe("Heater 1");
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
      z: -10,
      ...opponentPlayer
    },
    projectiles: [],
    structures: [],
    ...rest
  };
}

function createStructure(
  type: SessionSnapshot["structures"][number]["type"],
  ownerSlot: SessionSnapshot["structures"][number]["ownerSlot"],
  id: string
): SessionSnapshot["structures"][number] {
  return {
    enabled: true,
    expiresAt: 5_000,
    hp: 100,
    id,
    ownerSlot,
    type,
    x: 0,
    z: 0
  };
}
