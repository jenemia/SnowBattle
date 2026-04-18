import type { SessionSnapshot } from "@snowbattle/shared";

import { presentDuelHud, presentSoloHud } from "./hudPresenter";

export type ResultOverlayMode = "solo" | "duel";

export interface ResultOverlayViewModel {
  readout: string;
  reason: string;
  title: string;
}

export function getResultOverlayViewModel(
  snapshot: SessionSnapshot,
  mode: ResultOverlayMode
): ResultOverlayViewModel {
  const hud = mode === "duel" ? presentDuelHud(snapshot) : presentSoloHud(snapshot);
  const readout =
    snapshot.hud.result === null && snapshot.match.lifecycle === "finished"
      ? getResolvedReadout(mode)
      : hud.readoutText;

  return {
    readout,
    reason: hud.resultText,
    title: getResultTitle(snapshot)
  };
}

function getResolvedReadout(mode: ResultOverlayMode) {
  return mode === "duel"
    ? "Round complete. Requeue when you're ready for another live duel."
    : "Round complete. Queue another local run whenever you want.";
}

function getResultTitle(snapshot: SessionSnapshot) {
  if (snapshot.hud.result === null) {
    return "Round complete";
  }

  if (snapshot.hud.result.winnerSlot === snapshot.localPlayer.slot) {
    return "Victory";
  }

  if (snapshot.hud.result.winnerSlot === null) {
    return "Draw";
  }

  return "Defeat";
}
