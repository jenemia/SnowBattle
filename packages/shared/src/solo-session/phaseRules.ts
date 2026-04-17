import { ARENA_HALF_EXTENT } from "../constants.js";
import type { MatchPhase, SessionResultSnapshot } from "../session.js";
import type { SoloRuntimeState } from "./runtimeTypes.js";

export function getCurrentPhase(runtime: SoloRuntimeState): MatchPhase {
  if (runtime.elapsedMs >= runtime.rules.finalPushStartMs) {
    return "final_push";
  }

  if (runtime.elapsedMs >= runtime.rules.whiteoutStartMs) {
    return "whiteout";
  }

  return "standard";
}

export function getWhiteoutRadius(runtime: SoloRuntimeState) {
  if (runtime.elapsedMs < runtime.rules.whiteoutStartMs) {
    return ARENA_HALF_EXTENT;
  }

  if (runtime.elapsedMs >= runtime.rules.finalPushStartMs) {
    return runtime.rules.whiteoutTargetRadius;
  }

  const progress =
    (runtime.elapsedMs - runtime.rules.whiteoutStartMs) /
    (runtime.rules.finalPushStartMs - runtime.rules.whiteoutStartMs);

  return (
    ARENA_HALF_EXTENT -
    (ARENA_HALF_EXTENT - runtime.rules.whiteoutTargetRadius) * progress
  );
}

export function getTimeRemainingMs(runtime: SoloRuntimeState) {
  return Math.max(0, runtime.rules.matchDurationMs - runtime.elapsedMs);
}

export function isMatchExpired(runtime: SoloRuntimeState) {
  return runtime.elapsedMs >= runtime.rules.matchDurationMs;
}

export function resolveTimeout(
  runtime: SoloRuntimeState,
  localSlot: "A" | "B"
): SessionResultSnapshot {
  const localPlayer = runtime.players[localSlot];
  const opponentPlayer = runtime.players[localSlot === "A" ? "B" : "A"];

  if (localPlayer.hp !== opponentPlayer.hp) {
    return {
      reason: "timeout",
      winnerSlot: localPlayer.hp > opponentPlayer.hp ? localPlayer.slot : opponentPlayer.slot
    };
  }

  if (localPlayer.snowLoad !== opponentPlayer.snowLoad) {
    return {
      reason: "timeout",
      winnerSlot:
        localPlayer.snowLoad < opponentPlayer.snowLoad
          ? localPlayer.slot
          : opponentPlayer.slot
    };
  }

  if (localPlayer.totalDirectDamageDealt !== opponentPlayer.totalDirectDamageDealt) {
    return {
      reason: "timeout",
      winnerSlot:
        localPlayer.totalDirectDamageDealt > opponentPlayer.totalDirectDamageDealt
          ? localPlayer.slot
          : opponentPlayer.slot
    };
  }

  if (runtime.centerControlTime.A !== runtime.centerControlTime.B) {
    return {
      reason: "timeout",
      winnerSlot: runtime.centerControlTime.A > runtime.centerControlTime.B ? "A" : "B"
    };
  }

  return { winnerSlot: null, reason: "timeout" };
}
