import { describe, expect, it } from "vitest";

import {
  DEFAULT_MATCH_RULES,
  type SessionSnapshot
} from "@snowbattle/shared";

import type { SessionHudElements } from "./hudPresenter";
import { presentDuelHud, presentSoloHud, renderSessionHud } from "./hudPresenter";

type MockTextElement = HTMLElement & { setCount: number };
type MockButtonElement = HTMLButtonElement & { setCount: number };
type MockSessionHudElements = SessionHudElements & {
  actionButton: MockButtonElement;
  readout: MockTextElement;
  result: MockTextElement;
  status: MockTextElement;
  timerBadge: MockTextElement;
};

describe("presentSoloHud", () => {
  it("shares minimal action and timer copy across solo and duel", () => {
    const snapshot = createSnapshot();
    const soloHud = presentSoloHud(snapshot);
    const duelHud = presentDuelHud(snapshot);

    expect(soloHud.statusText).toBe("Combat");
    expect(soloHud.actionDisabled).toBe(true);
    expect(duelHud.timerBadgeText).toBe(soloHud.timerBadgeText);
    expect(soloHud.timerBadgeText).toBe("02:00");
    expect(duelHud.actionText).toBe("Requeue");
    expect(soloHud.actionText).toBe("Restart round");
  });

  it("formats the match timer as mm:ss for the top-right badge", () => {
    const hud = presentSoloHud(
      createSnapshot({
        match: {
          timeRemainingMs: 89_100
        }
      })
    );

    expect(hud.timerBadgeText).toBe("01:30");
  });

  it("formats resolved result state for solo and duel surfaces", () => {
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

  it("only writes changed HUD fields when a previous view model is provided", () => {
    const elements = createSessionHudElements();
    const hud = presentDuelHud(createSnapshot());
    const updatedHud = {
      ...hud,
      timerBadgeText: "01:59"
    };

    renderSessionHud(elements, hud);
    const baselineTimerBadgeWrites = elements.timerBadge.setCount;
    const baselineStatusWrites = elements.status.setCount;

    renderSessionHud(elements, hud, hud);
    renderSessionHud(elements, updatedHud, hud);

    expect(elements.timerBadge.setCount).toBe(baselineTimerBadgeWrites + 1);
    expect(elements.status.setCount).toBe(baselineStatusWrites);
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

function createSessionHudElements() {
  return {
    actionButton: createMockButtonElement(),
    readout: createMockTextElement(),
    result: createMockTextElement(),
    status: createMockTextElement(),
    timerBadge: createMockTextElement()
  } as unknown as MockSessionHudElements;
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
