import {
  ARENA_HALF_EXTENT,
  PLAYER_SPEED,
  SOLO_HEATER_BEACON_RADIUS,
  SOLO_MAX_PACKED_SNOW,
  SOLO_MAX_SLOW_PENALTY,
  SOLO_PACKED_SNOW_REGEN_PER_SECOND,
  SOLO_SNOW_LOAD_MELT_DELAY_MS,
  SOLO_SNOW_LOAD_MELT_PER_SECOND,
  SOLO_SNOW_LOAD_SLOW_PER_20,
  SOLO_WHITEOUT_CENTER_CONTROL_RADIUS,
  SOLO_WHITEOUT_PLAYER_DAMAGE_PER_SECOND
} from "../constants";
import type { MatchPhase } from "../session";
import { clamp, circleIntersectsWall } from "./geometry";
import type { PlayerRuntimeState, SoloRuntimeState } from "./runtimeTypes";

export function updatePlayers(
  runtime: SoloRuntimeState,
  deltaMs: number,
  phase: MatchPhase,
  whiteoutRadius: number
) {
  const deltaSeconds = deltaMs / 1000;

  for (const player of Object.values(runtime.players)) {
    player.buildCooldownRemaining = Math.max(0, player.buildCooldownRemaining - deltaMs);
    player.fireCooldownRemaining = Math.max(0, player.fireCooldownRemaining - deltaMs);
    player.packedSnow = Math.min(
      SOLO_MAX_PACKED_SNOW,
      player.packedSnow + deltaSeconds * SOLO_PACKED_SNOW_REGEN_PER_SECOND
    );

    const meltRate = isInsideFriendlyHeater(runtime, player)
      ? SOLO_SNOW_LOAD_MELT_PER_SECOND + 6
      : SOLO_SNOW_LOAD_MELT_PER_SECOND;

    if (
      player.lastHitAt !== null &&
      runtime.elapsedMs - player.lastHitAt >= SOLO_SNOW_LOAD_MELT_DELAY_MS
    ) {
      player.snowLoad = Math.max(0, player.snowLoad - deltaSeconds * meltRate);
    }

    player.slowMultiplier = 1 - getSlowPenalty(player.snowLoad);

    const moveSpeed = PLAYER_SPEED * player.slowMultiplier;
    const desiredX = clamp(
      player.x + player.moveX * deltaSeconds * moveSpeed,
      -ARENA_HALF_EXTENT,
      ARENA_HALF_EXTENT
    );
    const desiredZ = clamp(
      player.z + player.moveZ * deltaSeconds * moveSpeed,
      -ARENA_HALF_EXTENT,
      ARENA_HALF_EXTENT
    );
    const resolved = resolveWallMovement(runtime, player, desiredX, desiredZ);
    player.x = resolved.x;
    player.z = resolved.z;

    const aimX = player.pointerActive ? player.aimX - player.x : 0;
    const aimZ = player.pointerActive
      ? player.aimZ - player.z
      : player.slot === "A"
        ? -1
        : 1;

    if (Math.hypot(aimX, aimZ) > 0.001) {
      player.facingAngle = Math.atan2(aimX, aimZ);
    }

    if (phase !== "standard" && Math.hypot(player.x, player.z) > whiteoutRadius) {
      player.hp = Math.max(0, player.hp - deltaSeconds * SOLO_WHITEOUT_PLAYER_DAMAGE_PER_SECOND);
    }

    if (
      phase === "whiteout" &&
      Math.hypot(player.x, player.z) <= SOLO_WHITEOUT_CENTER_CONTROL_RADIUS
    ) {
      runtime.centerControlTime[player.slot] += deltaMs;
    }
  }
}

function isInsideFriendlyHeater(runtime: SoloRuntimeState, player: PlayerRuntimeState) {
  return [...runtime.structures.values()].some(
    (structure) =>
      structure.type === "heater_beacon" &&
      structure.ownerSlot === player.slot &&
      Math.hypot(structure.x - player.x, structure.z - player.z) <=
        SOLO_HEATER_BEACON_RADIUS
  );
}

function resolveWallMovement(
  runtime: SoloRuntimeState,
  player: PlayerRuntimeState,
  nextX: number,
  nextZ: number
) {
  let resolvedX = nextX;

  for (const structure of runtime.structures.values()) {
    if (structure.type !== "wall") {
      continue;
    }

    if (circleIntersectsWall(resolvedX, player.z, 0.9, structure.x, structure.z)) {
      resolvedX = player.x;
      break;
    }
  }

  let resolvedZ = nextZ;

  for (const structure of runtime.structures.values()) {
    if (structure.type !== "wall") {
      continue;
    }

    if (circleIntersectsWall(resolvedX, resolvedZ, 0.9, structure.x, structure.z)) {
      resolvedZ = player.z;
      break;
    }
  }

  return { x: resolvedX, z: resolvedZ };
}

function getSlowPenalty(snowLoad: number) {
  return Math.min(
    SOLO_MAX_SLOW_PENALTY,
    (snowLoad / 20) * SOLO_SNOW_LOAD_SLOW_PER_20
  );
}
