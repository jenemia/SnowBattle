import type { SessionSnapshot } from "@snowbattle/shared";

export interface SoloHudViewModel {
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
  resetDisabled: boolean;
  resultText: string;
  snowLoadText: string;
  statusText: string;
  structuresText: string;
  timeText: string;
}

export function presentSoloHud(snapshot: SessionSnapshot): SoloHudViewModel {
  return {
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
    readoutText: getReadoutText(snapshot),
    resetDisabled: snapshot.hud.result === null,
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

function getReadoutText(snapshot: SessionSnapshot) {
  if (snapshot.hud.result !== null) {
    if (snapshot.hud.result.winnerSlot === snapshot.localPlayer.slot) {
      return "Round complete. Queue another local run whenever you want.";
    }

    if (snapshot.hud.result.winnerSlot === null) {
      return "Round complete. The solo rules engine resolved a draw.";
    }

    return "Round complete. Hit restart to iterate on the duel again.";
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
