import {
  SOLO_BUILD_COOLDOWN_MS,
  SOLO_SNOWMAN_TURRET_INTERVAL_MS,
  SOLO_SNOWMAN_TURRET_LOAD,
  SOLO_SNOWMAN_TURRET_RANGE,
  SOLO_WHITEOUT_STRUCTURE_DAMAGE_PER_SECOND
} from "../constants";
import type { BuildType, MatchPhase } from "../session";
import { createStructureState, getBuildCost, getStructureMaxCount, isBuildPreviewValid } from "./buildRules";
import { segmentHitsWall } from "./geometry";
import type {
  PlayerRuntimeState,
  SoloRuntimeState,
  StructureRuntimeState
} from "./runtimeTypes";

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

    const target = runtime.players[structure.ownerSlot === "A" ? "B" : "A"];
    const distance = Math.hypot(target.x - structure.x, target.z - structure.z);

    if (distance <= SOLO_SNOWMAN_TURRET_RANGE && hasLineOfSight(runtime, structure, target)) {
      target.snowLoad = Math.min(100, target.snowLoad + SOLO_SNOWMAN_TURRET_LOAD);
      target.lastHitAt = runtime.elapsedMs;
      target.slowMultiplier = 1 - getSlowPenalty(target.snowLoad);
    }

    structure.nextFireAt = runtime.elapsedMs + SOLO_SNOWMAN_TURRET_INTERVAL_MS;
  }
}

function hasLineOfSight(
  runtime: SoloRuntimeState,
  structure: StructureRuntimeState,
  target: PlayerRuntimeState
) {
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
      candidate.z
    );
  });
}

function getSlowPenalty(snowLoad: number) {
  return Math.min(0.35, (snowLoad / 20) * 0.07);
}
