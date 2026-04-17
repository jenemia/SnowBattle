import type { MatchLifecycle } from "../protocol.js";
import type { SessionMatchSnapshot, SessionSnapshot } from "../session.js";
import { getCurrentPhase, getTimeRemainingMs, getWhiteoutRadius } from "./phaseRules.js";
import { isBuildPreviewValid } from "./buildRules.js";
import type { SoloRuntimeState } from "./runtimeTypes.js";

export function createSnapshot(
  runtime: SoloRuntimeState,
  localSlot = runtime.localSlot
): SessionSnapshot {
  const localPlayer = { ...runtime.players[localSlot] };
  const opponentPlayer = { ...runtime.players[localSlot === "A" ? "B" : "A"] };
  const phase = getCurrentPhase(runtime);

  return {
    hud: {
      activeBonfire:
        runtime.bonfire.activationStart !== null && runtime.bonfire.claimedBy === null,
      buildPreviewValid: isBuildPreviewValid(
        runtime,
        localPlayer,
        localPlayer.selectedBuild,
        phase
      ),
      cursorX: localPlayer.aimX,
      cursorZ: localPlayer.aimZ,
      pointerActive: localPlayer.pointerActive,
      result: runtime.latestResult
    },
    localPlayer,
    match: createMatchSnapshot(runtime),
    opponentPlayer,
    projectiles: [...runtime.projectiles.values()].map((projectile) => ({
      expiresAt: projectile.expiresAt,
      id: projectile.id,
      ownerSlot: projectile.ownerSlot,
      sourceType: projectile.sourceType,
      x: projectile.x,
      z: projectile.z
    })),
    structures: [...runtime.structures.values()].map((structure) => ({ ...structure }))
  };
}

export function createMatchSnapshot(runtime: SoloRuntimeState): SessionMatchSnapshot {
  const phase = runtime.latestResult === null ? getCurrentPhase(runtime) : "finished";
  const lifecycle: MatchLifecycle = runtime.latestResult === null ? "in_match" : "finished";

  return {
    centerBonfireState:
      runtime.bonfire.claimedBy !== null
        ? "claimed"
        : runtime.bonfire.activationStart !== null
          ? "active"
          : "idle",
    centerControlTime: {
      A: runtime.centerControlTime.A,
      B: runtime.centerControlTime.B
    },
    countdownRemainingMs: 0,
    lifecycle,
    phase,
    timeRemainingMs: getTimeRemainingMs(runtime),
    whiteoutRadius: getWhiteoutRadius(runtime)
  };
}
