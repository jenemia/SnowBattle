import {
  SOLO_BONFIRE_CAPTURE_MS,
  SOLO_BONFIRE_DURATION_MS,
  SOLO_BONFIRE_PACKED_SNOW_REWARD,
  SOLO_BONFIRE_RADIUS,
  SOLO_BONFIRE_SNOW_LOAD_REWARD,
  SOLO_MAX_PACKED_SNOW
} from "../constants";
import type { SoloRuntimeState } from "./runtimeTypes";

const BONFIRE_ACTIVATIONS = [75_000, 135_000];

export function updateBonfire(runtime: SoloRuntimeState, deltaMs: number) {
  if (
    runtime.bonfire.activationStart !== null &&
    runtime.elapsedMs >= runtime.bonfire.activeUntil
  ) {
    runtime.bonfire.activationStart = null;
    runtime.bonfire.activeUntil = 0;
    runtime.bonfire.captureMs = { A: 0, B: 0 };
    runtime.bonfire.claimedBy = null;
    return;
  }

  if (runtime.bonfire.activationStart !== null) {
    return;
  }

  const activation = BONFIRE_ACTIVATIONS.find(
    (startAt) => runtime.elapsedMs >= startAt && runtime.elapsedMs < startAt + deltaMs
  );

  if (activation === undefined) {
    return;
  }

  runtime.bonfire.activationStart = activation;
  runtime.bonfire.activeUntil = activation + SOLO_BONFIRE_DURATION_MS;
  runtime.bonfire.captureMs = { A: 0, B: 0 };
  runtime.bonfire.claimedBy = null;
}

export function updateBonfireCapture(runtime: SoloRuntimeState, deltaMs: number) {
  if (runtime.bonfire.activationStart === null || runtime.bonfire.claimedBy !== null) {
    return;
  }

  for (const player of Object.values(runtime.players)) {
    if (Math.hypot(player.x, player.z) > SOLO_BONFIRE_RADIUS) {
      runtime.bonfire.captureMs[player.slot] = 0;
      continue;
    }

    runtime.bonfire.captureMs[player.slot] += deltaMs;
    if (runtime.bonfire.captureMs[player.slot] < SOLO_BONFIRE_CAPTURE_MS) {
      continue;
    }

    player.snowLoad = Math.max(0, player.snowLoad - SOLO_BONFIRE_SNOW_LOAD_REWARD);
    player.packedSnow = Math.min(
      SOLO_MAX_PACKED_SNOW,
      player.packedSnow + SOLO_BONFIRE_PACKED_SNOW_REWARD
    );
    runtime.bonfire.claimedBy = player.slot;
    break;
  }
}
