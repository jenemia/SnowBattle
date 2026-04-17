import {
  ARENA_HALF_EXTENT,
  SOLO_BUILD_COOLDOWN_MS,
  SOLO_SNOWMAN_TURRET_INTERVAL_MS,
  SOLO_SNOWMAN_TURRET_RANGE,
  SOLO_WHITEOUT_STRUCTURE_DAMAGE_PER_SECOND
} from "../constants.js";
import type { BuildType, MatchPhase } from "../session.js";
import { STATIC_ARENA_OBSTACLES } from "../staticObstacles.js";
import { createStructureState, getBuildCost, getStructureMaxCount, isBuildPreviewValid } from "./buildRules.js";
import {
  clamp,
  resolveCircleOutsideWall,
  segmentHitsCircle,
  segmentHitsWall
} from "./geometry.js";
import { spawnTurretProjectile } from "./projectileStep.js";
import type {
  PlayerRuntimeState,
  SoloRuntimeState,
  StructureRuntimeState
} from "./runtimeTypes.js";

const PLAYER_WALL_COLLISION_RADIUS = 0.9;
const WALL_PUSH_MARGIN = 0.05;

export function trySpawnStructure(
  runtime: SoloRuntimeState,
  player: PlayerRuntimeState,
  buildType: BuildType,
  phase: MatchPhase
) {
  if (phase === "final_push" || phase === "finished") {
    return false;
  }

  const cost = getBuildCost(buildType);
  if (player.buildCooldownRemaining > 0 || player.packedSnow < cost) {
    return false;
  }

  if (!isBuildPreviewValid(runtime, player, buildType, phase)) {
    return false;
  }

  const activeOwned = [...runtime.structures.values()].filter(
    (structure) => structure.ownerSlot === player.slot && structure.type === buildType
  );
  if (activeOwned.length >= getStructureMaxCount(buildType)) {
    return false;
  }

  const structure = createStructureState(
    runtime,
    player,
    buildType,
    runtime.elapsedMs + SOLO_SNOWMAN_TURRET_INTERVAL_MS
  );
  runtime.structures.set(structure.id, structure);
  if (structure.type === "wall") {
    pushPlayersOutOfWall(runtime, structure);
  }
  player.buildCooldownRemaining = SOLO_BUILD_COOLDOWN_MS;
  player.packedSnow -= cost;
  return true;
}

export function updateStructures(
  runtime: SoloRuntimeState,
  phase: MatchPhase,
  whiteoutRadius: number,
  deltaSeconds: number
) {
  for (const structure of runtime.structures.values()) {
    if (phase !== "standard" && Math.hypot(structure.x, structure.z) > whiteoutRadius) {
      structure.hp = Math.max(
        0,
        structure.hp - deltaSeconds * SOLO_WHITEOUT_STRUCTURE_DAMAGE_PER_SECOND
      );
    }

    if (!structure.enabled || structure.expiresAt <= runtime.elapsedMs || structure.hp <= 0) {
      runtime.structures.delete(structure.id);
      continue;
    }

    if (structure.type !== "snowman_turret" || structure.nextFireAt > runtime.elapsedMs) {
      continue;
    }

    const target = getAutoTargetPlayer(runtime, structure);
    if (target) {
      spawnTurretProjectile(runtime, structure, target);
    }

    structure.nextFireAt = runtime.elapsedMs + SOLO_SNOWMAN_TURRET_INTERVAL_MS;
  }
}

function getAutoTargetPlayer(
  runtime: SoloRuntimeState,
  structure: StructureRuntimeState
) {
  const candidates = Object.values(runtime.players)
    .filter((candidate) => candidate.slot !== structure.ownerSlot && candidate.hp > 0)
    .map((candidate) => ({
      distance: Math.hypot(candidate.x - structure.x, candidate.z - structure.z),
      player: candidate
    }))
    .filter(({ distance, player }) => {
      return (
        distance <= SOLO_SNOWMAN_TURRET_RANGE &&
        hasLineOfSight(runtime, structure, player)
      );
    })
    .sort((left, right) => left.distance - right.distance);

  return candidates[0]?.player ?? null;
}

function hasLineOfSight(
  runtime: SoloRuntimeState,
  structure: StructureRuntimeState,
  target: PlayerRuntimeState
) {
  if (
    STATIC_ARENA_OBSTACLES.some((obstacle) =>
      segmentHitsCircle(
        structure.x,
        structure.z,
        target.x,
        target.z,
        obstacle.x,
        obstacle.z,
        obstacle.blockingRadius
      )
    )
  ) {
    return false;
  }

  return ![...runtime.structures.values()].some((candidate) => {
    if (candidate.type !== "wall") {
      return false;
    }

    return segmentHitsWall(
      structure.x,
      structure.z,
      target.x,
      target.z,
      candidate.x,
      candidate.z,
      candidate.rotationY ?? 0
    );
  });
}

function pushPlayersOutOfWall(
  runtime: SoloRuntimeState,
  structure: StructureRuntimeState
) {
  for (const player of Object.values(runtime.players)) {
    const resolved = resolveCircleOutsideWall(
      player.x,
      player.z,
      PLAYER_WALL_COLLISION_RADIUS,
      structure.x,
      structure.z,
      structure.rotationY ?? 0,
      WALL_PUSH_MARGIN
    );

    if (!resolved.overlapped) {
      continue;
    }

    player.x = clamp(resolved.x, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT);
    player.z = clamp(resolved.z, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT);
  }
}
