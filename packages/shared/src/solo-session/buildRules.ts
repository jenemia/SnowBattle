import {
  PLAYER_SPAWN_OFFSET,
  SOLO_BUILD_COOLDOWN_MS,
  SOLO_HEATER_BEACON_COST,
  SOLO_HEATER_BEACON_DURATION_MS,
  SOLO_HEATER_BEACON_HP,
  SOLO_MAX_WALLS,
  SOLO_SNOWMAN_TURRET_COST,
  SOLO_SNOWMAN_TURRET_DURATION_MS,
  SOLO_SNOWMAN_TURRET_HP,
  SOLO_SPAWN_EXCLUSION_RADIUS,
  SOLO_SPAWN_RANGE,
  SOLO_STRUCTURE_COLLISION_RADIUS,
  SOLO_WALL_COST,
  SOLO_WALL_DURATION_MS,
  SOLO_WALL_HP
} from "../constants.js";
import type { BuildType, MatchPhase } from "../session.js";
import type {
  PlayerRuntimeState,
  SoloRuntimeState,
  StructureRuntimeState
} from "./runtimeTypes.js";

const HEATER_OR_TURRET_LIMIT = 1;

export function getBuildCost(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_COST;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_COST;
  }

  return SOLO_HEATER_BEACON_COST;
}

export function getStructureDuration(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_DURATION_MS;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_DURATION_MS;
  }

  return SOLO_HEATER_BEACON_DURATION_MS;
}

export function getStructureHp(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_HP;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_HP;
  }

  return SOLO_HEATER_BEACON_HP;
}

export function getStructureMaxCount(buildType: BuildType) {
  return buildType === "wall" ? SOLO_MAX_WALLS : HEATER_OR_TURRET_LIMIT;
}

export function getWallStructureRotationY(
  playerX: number,
  playerZ: number,
  wallX: number,
  wallZ: number
) {
  const deltaX = playerX - wallX;
  const deltaZ = playerZ - wallZ;

  if (Math.hypot(deltaX, deltaZ) <= 0.001) {
    return 0;
  }

  return Math.atan2(deltaX, deltaZ);
}

export function isBuildPreviewValid(
  runtime: SoloRuntimeState,
  player: PlayerRuntimeState,
  buildType: BuildType | null,
  currentPhase: MatchPhase
) {
  if (
    buildType === null ||
    currentPhase === "final_push" ||
    currentPhase === "finished"
  ) {
    return false;
  }

  const cost = getBuildCost(buildType);
  if (player.buildCooldownRemaining > 0 || player.packedSnow < cost) {
    return false;
  }

  const distance = Math.hypot(player.aimX - player.x, player.aimZ - player.z);
  if (distance > SOLO_SPAWN_RANGE) {
    return false;
  }

  const spawnDistance = Math.min(
    Math.hypot(player.aimX, player.aimZ - PLAYER_SPAWN_OFFSET),
    Math.hypot(player.aimX, player.aimZ + PLAYER_SPAWN_OFFSET)
  );
  if (spawnDistance < SOLO_SPAWN_EXCLUSION_RADIUS) {
    return false;
  }

  if (
    Object.values(runtime.players).some(
      (candidate) => Math.hypot(candidate.x - player.aimX, candidate.z - player.aimZ) < 1.5
    )
  ) {
    return false;
  }

  return ![...runtime.structures.values()].some(
    (structure) =>
      Math.hypot(structure.x - player.aimX, structure.z - player.aimZ) <
      SOLO_STRUCTURE_COLLISION_RADIUS * 2
  );
}

export function createStructureState(
  runtime: SoloRuntimeState,
  player: PlayerRuntimeState,
  buildType: BuildType,
  nextFireAt: number
): StructureRuntimeState {
  return {
    enabled: true,
    expiresAt: runtime.elapsedMs + getStructureDuration(buildType),
    hp: getStructureHp(buildType),
    id: `${buildType}-${player.slot}-${runtime.structures.size + 1}`,
    nextFireAt,
    ownerSlot: player.slot,
    rotationY:
      buildType === "wall"
        ? getWallStructureRotationY(player.x, player.z, player.aimX, player.aimZ)
        : 0,
    type: buildType,
    x: player.aimX,
    z: player.aimZ
  };
}

export { SOLO_BUILD_COOLDOWN_MS };
