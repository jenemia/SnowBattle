import { describe, expect, it } from "vitest";

import type { SessionSnapshot } from "@snowbattle/shared";

import {
  type DuelSkillStripElements,
  type SessionHudElements,
  presentDuelHud,
  presentDuelSkillStrip,
  presentSoloHud,
  renderDuelSkillStrip,
  renderSessionHud
} from "./hudPresenter";

type MockTextElement = HTMLElement & { setCount: number };
type MockButtonElement = HTMLButtonElement & { setCount: number };
type MockSessionHudElements = SessionHudElements & {
  actionButton: MockButtonElement;
  bonfire: MockTextElement;
  build: MockTextElement;
  cooldown: MockTextElement;
  cursor: MockTextElement;
  hp: MockTextElement;
  mode: MockTextElement;
  opponentHp: MockTextElement;
  packedSnow: MockTextElement;
  phase: MockTextElement;
  position: MockTextElement;
  preview: MockTextElement;
  projectiles: MockTextElement;
  readout: MockTextElement;
  result: MockTextElement;
  snowLoad: MockTextElement;
  status: MockTextElement;
  structures: MockTextElement;
  time: MockTextElement;
};
type MockSkillStripElements = DuelSkillStripElements & {
  cooldown: MockTextElement;
  heaterBeacon: MockTextElement;
  snowmanTurret: MockTextElement;
  wall: MockTextElement;
};

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

  it("only writes changed HUD fields when a previous view model is provided", () => {
    const elements = createSessionHudElements();
    const hud = presentDuelHud(createSnapshot());
    const updatedHud = {
      ...hud,
      timeText: "179.9s"
    };

    renderSessionHud(elements, hud);
    const baselineTimeWrites = elements.time.setCount;
    const baselineHpWrites = elements.hp.setCount;

    renderSessionHud(elements, hud, hud);
    renderSessionHud(elements, updatedHud, hud);

    expect(elements.time.setCount).toBe(baselineTimeWrites + 1);
    expect(elements.hp.setCount).toBe(baselineHpWrites);
  });

  it("only writes changed skill strip fields when a previous view model is provided", () => {
    const elements = createSkillStripElements();
    const strip = presentDuelSkillStrip(createSnapshot());
    const updatedStrip = {
      ...strip,
      cooldownText: "0.25s"
    };

    renderDuelSkillStrip(elements, strip);
    const baselineCooldownWrites = elements.cooldown.setCount;
    const baselineWallWrites = elements.wall.setCount;

    renderDuelSkillStrip(elements, strip, strip);
    renderDuelSkillStrip(elements, updatedStrip, strip);

    expect(elements.cooldown.setCount).toBe(baselineCooldownWrites + 1);
    expect(elements.wall.setCount).toBe(baselineWallWrites);
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

function createSessionHudElements() {
  return {
    actionButton: createMockButtonElement(),
    bonfire: createMockTextElement(),
    build: createMockTextElement(),
    cooldown: createMockTextElement(),
    cursor: createMockTextElement(),
    hp: createMockTextElement(),
    mode: createMockTextElement(),
    opponentHp: createMockTextElement(),
    packedSnow: createMockTextElement(),
    phase: createMockTextElement(),
    position: createMockTextElement(),
    preview: createMockTextElement(),
    projectiles: createMockTextElement(),
    readout: createMockTextElement(),
    result: createMockTextElement(),
    snowLoad: createMockTextElement(),
    status: createMockTextElement(),
    structures: createMockTextElement(),
    time: createMockTextElement()
  } as unknown as MockSessionHudElements;
}

function createSkillStripElements() {
  return {
    cooldown: createMockTextElement(),
    heaterBeacon: createMockTextElement(),
    snowmanTurret: createMockTextElement(),
    wall: createMockTextElement()
  } as unknown as MockSkillStripElements;
}

function createMockButtonElement() {
  const element = createMockTextElement() as MockButtonElement;

  element.disabled = false;
  return element;
}

function createMockTextElement() {
  let value: string | null = null;
  const target = {
    setCount: 0
  } as {
    setCount: number;
    textContent: string | null;
  };

  Object.defineProperty(target, "textContent", {
    get() {
      return value;
    },
    set(next: string | null) {
      value = next;
      target.setCount += 1;
    }
  });

  return target as MockTextElement;
}
