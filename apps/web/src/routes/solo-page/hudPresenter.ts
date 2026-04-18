import type { SessionSnapshot } from "@snowbattle/shared";

export type SessionHudMode = "solo" | "duel";

export interface SessionHudViewModel {
  actionDisabled: boolean;
  actionText: string;
  readoutText: string;
  resultText: string;
  statusText: string;
  timerBadgeText: string;
}

export interface SessionHudElements {
  actionButton?: HTMLButtonElement;
  readout?: HTMLElement;
  result?: HTMLElement;
  status?: HTMLElement;
  timerBadge?: HTMLElement;
}

export function presentSessionHud(
  snapshot: SessionSnapshot,
  mode: SessionHudMode
): SessionHudViewModel {
  const copy = HUD_COPY[mode];

  return {
    actionDisabled: snapshot.hud.result === null,
    actionText: copy.actionText,
    readoutText: getReadoutText(snapshot, copy),
    resultText: getResultText(snapshot),
    statusText: getStatusText(snapshot),
    timerBadgeText: formatMatchClock(snapshot.match.timeRemainingMs)
  };
}

export function presentSoloHud(snapshot: SessionSnapshot): SessionHudViewModel {
  return presentSessionHud(snapshot, "solo");
}

export function presentDuelHud(snapshot: SessionSnapshot): SessionHudViewModel {
  return presentSessionHud(snapshot, "duel");
}

export function renderSessionHud(
  elements: SessionHudElements,
  hud: SessionHudViewModel,
  previous: SessionHudViewModel | null = null
) {
  if (elements.status) {
    setTextIfChanged(elements.status, previous?.statusText, hud.statusText);
  }

  if (elements.readout) {
    setTextIfChanged(elements.readout, previous?.readoutText, hud.readoutText);
  }

  if (elements.result) {
    setTextIfChanged(elements.result, previous?.resultText, hud.resultText);
  }

  if (elements.timerBadge) {
    setTextIfChanged(
      elements.timerBadge,
      previous?.timerBadgeText,
      hud.timerBadgeText
    );
  }

  if (elements.actionButton) {
    if (previous?.actionDisabled !== hud.actionDisabled) {
      elements.actionButton.disabled = hud.actionDisabled;
    }

    setTextIfChanged(elements.actionButton, previous?.actionText, hud.actionText);
  }
}

function getStatusText(snapshot: SessionSnapshot) {
  if (snapshot.hud.result !== null) {
    return "Complete";
  }

  if (snapshot.match.phase === "final_push") {
    return "Final push";
  }

  if (snapshot.match.phase === "whiteout") {
    return "Whiteout";
  }

  return snapshot.localPlayer.selectedBuild === null ? "Combat" : "Build";
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

function getReadoutText(snapshot: SessionSnapshot, copy: SessionHudCopy) {
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
    return "Whiteout is closing in. Stay inside the ring.";
  }

  if (snapshot.localPlayer.selectedBuild === null) {
    return "Combat mode. Aim with the cursor and click to throw.";
  }

  return snapshot.hud.buildPreviewValid
    ? `Build ${snapshot.localPlayer.selectedBuild}. Click to place.`
    : `Build ${snapshot.localPlayer.selectedBuild}. Move to a valid spot.`;
}

function formatMatchClock(timeRemainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

function setTextIfChanged(
  element: Pick<HTMLElement, "textContent">,
  previous: string | undefined,
  next: string
) {
  if (previous !== next) {
    element.textContent = next;
  }
}
