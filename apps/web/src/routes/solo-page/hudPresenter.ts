import type { SessionSnapshot } from "@snowbattle/shared";

export type SessionHudMode = "solo" | "duel";

export interface SoloHudViewModel {
  actionDisabled: boolean;
  actionText: string;
  bonfireText: string;
  buildText: string;
  cooldownText: string;
  cursorText: string;
  hpText: string;
  modeText: string;
  opponentHpText: string;
  packedSnowText: string;
  phaseText: string;
  positionText: string;
  previewText: string;
  projectilesText: string;
  readoutText: string;
  resultText: string;
  snowLoadText: string;
  statusText: string;
  structuresText: string;
  timeText: string;
}

export interface SessionHudElements {
  actionButton?: HTMLButtonElement;
  bonfire: HTMLElement;
  build: HTMLElement;
  cooldown: HTMLElement;
  cursor: HTMLElement;
  hp: HTMLElement;
  mode: HTMLElement;
  opponentHp: HTMLElement;
  packedSnow: HTMLElement;
  phase: HTMLElement;
  position: HTMLElement;
  preview: HTMLElement;
  projectiles: HTMLElement;
  readout: HTMLElement;
  result: HTMLElement;
  snowLoad: HTMLElement;
  status: HTMLElement;
  structures: HTMLElement;
  time: HTMLElement;
}

export function presentSessionHud(
  snapshot: SessionSnapshot,
  mode: SessionHudMode
): SoloHudViewModel {
  const copy = HUD_COPY[mode];

  return {
    actionDisabled: snapshot.hud.result === null,
    actionText: copy.actionText,
    bonfireText: snapshot.match.centerBonfireState,
    buildText: snapshot.localPlayer.selectedBuild ?? "combat",
    cooldownText: `${(snapshot.localPlayer.buildCooldownRemaining / 1000).toFixed(2)}s`,
    cursorText: `${snapshot.hud.cursorX.toFixed(1)} / ${snapshot.hud.cursorZ.toFixed(1)}`,
    hpText: `${Math.round(snapshot.localPlayer.hp)}`,
    modeText: getModeText(snapshot),
    opponentHpText: `${Math.round(snapshot.opponentPlayer.hp)}`,
    packedSnowText: `${Math.round(snapshot.localPlayer.packedSnow)}`,
    phaseText: snapshot.match.phase,
    positionText: `${snapshot.localPlayer.x.toFixed(1)} / ${snapshot.localPlayer.z.toFixed(1)}`,
    previewText: snapshot.hud.buildPreviewValid ? "valid" : "blocked",
    projectilesText: String(snapshot.projectiles.length),
    readoutText: getReadoutText(snapshot, copy),
    resultText: getResultText(snapshot),
    snowLoadText: `${Math.round(snapshot.localPlayer.snowLoad)}`,
    statusText:
      snapshot.hud.result !== null
        ? "Complete"
        : snapshot.localPlayer.selectedBuild === null
          ? "Combat"
          : "Build",
    structuresText: String(snapshot.structures.length),
    timeText: `${(snapshot.match.timeRemainingMs / 1000).toFixed(1)}s`
  };
}

export function presentSoloHud(snapshot: SessionSnapshot): SoloHudViewModel {
  return presentSessionHud(snapshot, "solo");
}

export function presentDuelHud(snapshot: SessionSnapshot): SoloHudViewModel {
  return presentSessionHud(snapshot, "duel");
}

export function renderSessionHud(
  elements: SessionHudElements,
  hud: SoloHudViewModel
) {
  elements.bonfire.textContent = hud.bonfireText;
  elements.build.textContent = hud.buildText;
  elements.cooldown.textContent = hud.cooldownText;
  elements.cursor.textContent = hud.cursorText;
  elements.hp.textContent = hud.hpText;
  elements.mode.textContent = hud.modeText;
  elements.opponentHp.textContent = hud.opponentHpText;
  elements.packedSnow.textContent = hud.packedSnowText;
  elements.phase.textContent = hud.phaseText;
  elements.position.textContent = hud.positionText;
  elements.preview.textContent = hud.previewText;
  elements.projectiles.textContent = hud.projectilesText;
  elements.readout.textContent = hud.readoutText;
  elements.result.textContent = hud.resultText;
  elements.snowLoad.textContent = hud.snowLoadText;
  elements.status.textContent = hud.statusText;
  elements.structures.textContent = hud.structuresText;
  elements.time.textContent = hud.timeText;

  if (elements.actionButton) {
    elements.actionButton.disabled = hud.actionDisabled;
    elements.actionButton.textContent = hud.actionText;
  }
}

function getModeText(snapshot: SessionSnapshot) {
  if (snapshot.hud.result !== null) {
    return "Round resolved";
  }

  if (snapshot.match.phase === "final_push") {
    return "Final push · Builds locked";
  }

  if (snapshot.match.phase === "whiteout") {
    return "Whiteout · Stay in the ring";
  }

  if (snapshot.localPlayer.selectedBuild === null) {
    return snapshot.localPlayer.buildCooldownRemaining > 0
      ? "Snowball cooling"
      : "Throw ready";
  }

  return snapshot.hud.buildPreviewValid ? "Placement valid" : "Placement blocked";
}

function getResultText(snapshot: SessionSnapshot) {
  if (snapshot.hud.result === null) {
    return "";
  }

  if (snapshot.hud.result.winnerSlot === snapshot.localPlayer.slot) {
    return `Victory · ${snapshot.hud.result.reason}`;
  }

  if (snapshot.hud.result.winnerSlot === null) {
    return `Draw · ${snapshot.hud.result.reason}`;
  }

  return `Defeat · ${snapshot.hud.result.reason}`;
}

function getReadoutText(
  snapshot: SessionSnapshot,
  copy: SessionHudCopy
) {
  if (snapshot.hud.result !== null) {
    if (snapshot.hud.result.winnerSlot === snapshot.localPlayer.slot) {
      return copy.winReadout;
    }

    if (snapshot.hud.result.winnerSlot === null) {
      return copy.drawReadout;
    }

    return copy.loseReadout;
  }

  if (snapshot.match.phase === "final_push") {
    return "Final push is active. Builds are locked, so finish the duel in the ring.";
  }

  if (snapshot.match.phase === "whiteout") {
    return "Whiteout is closing in. Use the ring and bonfire timing to stay alive.";
  }

  if (snapshot.localPlayer.selectedBuild === null) {
    return "Combat mode. Aim with the cursor and click to throw.";
  }

  return snapshot.hud.buildPreviewValid
    ? `Build ${snapshot.localPlayer.selectedBuild}. Click to place.`
    : `Build ${snapshot.localPlayer.selectedBuild}. Move to a valid spot.`;
}

interface SessionHudCopy {
  actionText: string;
  drawReadout: string;
  loseReadout: string;
  winReadout: string;
}

const HUD_COPY: Record<SessionHudMode, SessionHudCopy> = {
  duel: {
    actionText: "Requeue",
    drawReadout: "Round complete. The live duel resolved as a draw.",
    loseReadout: "Round complete. Requeue when you're ready for another live duel.",
    winReadout: "Round complete. Requeue whenever you want another live duel."
  },
  solo: {
    actionText: "Restart round",
    drawReadout: "Round complete. The solo rules engine resolved a draw.",
    loseReadout: "Round complete. Hit restart to iterate on the duel again.",
    winReadout: "Round complete. Queue another local run whenever you want."
  }
};
