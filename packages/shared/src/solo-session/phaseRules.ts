import {
  ARENA_HALF_EXTENT,
  SOLO_FINAL_PUSH_START_MS,
  SOLO_MATCH_DURATION_MS,
  SOLO_WHITEOUT_START_MS,
  SOLO_WHITEOUT_TARGET_RADIUS
} from "../constants";
import type { MatchPhase, SessionResultSnapshot } from "../session";
import type { SoloRuntimeState } from "./runtimeTypes";

export function getCurrentPhase(runtime: SoloRuntimeState): MatchPhase {
  if (runtime.elapsedMs >= SOLO_FINAL_PUSH_START_MS) {
    return "final_push";
  }

  if (runtime.elapsedMs >= SOLO_WHITEOUT_START_MS) {
    return "whiteout";
  }

  return "standard";
}

export function getWhiteoutRadius(runtime: SoloRuntimeState) {
  if (runtime.elapsedMs < SOLO_WHITEOUT_START_MS) {
    return ARENA_HALF_EXTENT;
  }

  if (runtime.elapsedMs >= SOLO_FINAL_PUSH_START_MS) {
    return SOLO_WHITEOUT_TARGET_RADIUS;
  }

  const progress =
    (runtime.elapsedMs - SOLO_WHITEOUT_START_MS) /
    (SOLO_FINAL_PUSH_START_MS - SOLO_WHITEOUT_START_MS);

  return (
    ARENA_HALF_EXTENT -
    (ARENA_HALF_EXTENT - SOLO_WHITEOUT_TARGET_RADIUS) * progress
  );
}

export function getTimeRemainingMs(runtime: SoloRuntimeState) {
  return Math.max(0, SOLO_MATCH_DURATION_MS - runtime.elapsedMs);
}

export function isMatchExpired(runtime: SoloRuntimeState) {
  return runtime.elapsedMs >= SOLO_MATCH_DURATION_MS;
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
