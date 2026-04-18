import {
  ARENA_HALF_EXTENT,
  PLAYER_SPEED,
  SERVER_TICK_RATE,
  SOLO_BONFIRE_RADIUS,
  SOLO_SNOWBALL_RANGE
} from "../constants.js";
import type { MatchPhase } from "../session.js";
import { STATIC_ARENA_OBSTACLES } from "../staticObstacles.js";
import {
  circleIntersectsCircle,
  circleIntersectsWall,
  segmentHitsCircle,
  segmentHitsWall
} from "./geometry.js";
import { trySpawnProjectile } from "./projectileStep.js";
import type { PlayerRuntimeState, SoloRuntimeState } from "./runtimeTypes.js";

const BOT_COLLISION_RADIUS = 0.9;
const BOT_SELF_SIDE_STEP = 3.5;
const BOT_TARGET_SIDE_STEP = 4;
const BOT_FORWARD_STEP = 3.5;
const BOT_REPOSITION_ARRIVAL_RADIUS = 0.6;
const BOT_NAV_STEP_DISTANCE = PLAYER_SPEED / SERVER_TICK_RATE;

export function updateBot(
  runtime: SoloRuntimeState,
  bot: PlayerRuntimeState,
  target: PlayerRuntimeState,
  phase: MatchPhase,
  whiteoutRadius: number
) {
  const activeBonfire =
    runtime.bonfire.activationStart !== null && runtime.bonfire.claimedBy === null;

  if (
    activeBonfire &&
    (bot.snowLoad >= 30 || bot.packedSnow <= 55) &&
    Math.hypot(bot.x, bot.z) > SOLO_BONFIRE_RADIUS * 0.5
  ) {
    bot.aimX = 0;
    bot.aimZ = 0;
    const toCenter = Math.hypot(-bot.x, -bot.z) || 1;
    bot.moveX = -bot.x / toCenter;
    bot.moveZ = -bot.z / toCenter;
    return;
  }

  if (phase !== "standard" && Math.hypot(bot.x, bot.z) > whiteoutRadius) {
    const toCenter = Math.hypot(-bot.x, -bot.z) || 1;
    bot.moveX = -bot.x / toCenter;
    bot.moveZ = -bot.z / toCenter;
    bot.aimX = target.x;
    bot.aimZ = target.z;
    bot.pointerActive = true;
    return;
  }

  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const distance = Math.hypot(dx, dz);
  const directionX = distance > 0 ? dx / distance : 0;
  const directionZ = distance > 0 ? dz / distance : 0;
  const strafeSign = Math.sin(runtime.elapsedMs / 700) >= 0 ? 1 : -1;

  bot.aimX = target.x;
  bot.aimZ = target.z;
  bot.pointerActive = true;

  const hasShotWindow = hasBotShotWindow(runtime, bot, target);
  if (hasShotWindow) {
    bot.botRepositionTargetX = null;
    bot.botRepositionTargetZ = null;
  }

  if (!hasShotWindow) {
    const repositionTarget =
      getRetainedBotRepositionTarget(runtime, bot, target) ??
      findBotRepositionTarget(runtime, bot, target);

    if (repositionTarget) {
      bot.botRepositionTargetX = repositionTarget.x;
      bot.botRepositionTargetZ = repositionTarget.z;

      const moveX = repositionTarget.x - bot.x;
      const moveZ = repositionTarget.z - bot.z;
      const moveLength = Math.hypot(moveX, moveZ) || 1;

      bot.moveX = moveX / moveLength;
      bot.moveZ = moveZ / moveLength;
      return;
    }
  }

  bot.botRepositionTargetX = null;
  bot.botRepositionTargetZ = null;

  if (distance > 8.5) {
    bot.moveX = directionX;
    bot.moveZ = directionZ;
  } else if (distance < 5.5) {
    bot.moveX = -directionX * 0.7 + strafeSign * directionZ * 0.5;
    bot.moveZ = -directionZ * 0.7 - strafeSign * directionX * 0.5;
  } else {
    bot.moveX = strafeSign * directionZ * 0.7;
    bot.moveZ = -strafeSign * directionX * 0.7;
  }

  const length = Math.hypot(bot.moveX, bot.moveZ);
  if (length > 0.001) {
    bot.moveX /= length;
    bot.moveZ /= length;
  }

  if (hasShotWindow && bot.fireCooldownRemaining <= 0) {
    trySpawnProjectile(runtime, bot);
  }
}

function hasBotShotWindow(
  runtime: SoloRuntimeState,
  bot: PlayerRuntimeState,
  target: PlayerRuntimeState
) {
  return (
    Math.hypot(target.x - bot.x, target.z - bot.z) <= SOLO_SNOWBALL_RANGE &&
    hasBotLineOfSight(runtime, bot.x, bot.z, target)
  );
}

function findBotRepositionTarget(
  runtime: SoloRuntimeState,
  bot: PlayerRuntimeState,
  target: PlayerRuntimeState
) {
  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const distance = Math.hypot(dx, dz) || 1;
  const directionX = dx / distance;
  const directionZ = dz / distance;
  const sideX = -directionZ;
  const sideZ = directionX;

  const localCandidates = [
    {
      x: bot.x + sideX * BOT_SELF_SIDE_STEP,
      z: bot.z + sideZ * BOT_SELF_SIDE_STEP
    },
    {
      x: bot.x - sideX * BOT_SELF_SIDE_STEP,
      z: bot.z - sideZ * BOT_SELF_SIDE_STEP
    },
    {
      x: bot.x + directionX * BOT_FORWARD_STEP,
      z: bot.z + directionZ * BOT_FORWARD_STEP
    }
  ];
  const clearLaneCandidates = [
    {
      x: target.x + sideX * BOT_TARGET_SIDE_STEP,
      z: target.z + sideZ * BOT_TARGET_SIDE_STEP
    },
    {
      x: target.x - sideX * BOT_TARGET_SIDE_STEP,
      z: target.z - sideZ * BOT_TARGET_SIDE_STEP
    },
  ];

  const localWaypoint = pickBotRepositionCandidate(
    runtime,
    bot,
    target,
    localCandidates,
    false
  );
  if (localWaypoint) {
    return localWaypoint;
  }

  return pickBotRepositionCandidate(runtime, bot, target, clearLaneCandidates, true);
}

function isBotMovePositionValid(
  runtime: SoloRuntimeState,
  x: number,
  z: number
) {
  if (
    x < -ARENA_HALF_EXTENT ||
    x > ARENA_HALF_EXTENT ||
    z < -ARENA_HALF_EXTENT ||
    z > ARENA_HALF_EXTENT
  ) {
    return false;
  }

  if (
    STATIC_ARENA_OBSTACLES.some((obstacle) =>
      circleIntersectsCircle(
        x,
        z,
        BOT_COLLISION_RADIUS,
        obstacle.x,
        obstacle.z,
        obstacle.blockingRadius
      )
    )
  ) {
    return false;
  }

  return ![...runtime.structures.values()].some((structure) => {
    if (structure.type !== "wall") {
      return false;
    }

    return circleIntersectsWall(
      x,
      z,
      BOT_COLLISION_RADIUS,
      structure.x,
      structure.z,
      structure.rotationY ?? 0
    );
  });
}

function getRetainedBotRepositionTarget(
  runtime: SoloRuntimeState,
  bot: PlayerRuntimeState,
  target: PlayerRuntimeState
) {
  const x = bot.botRepositionTargetX;
  const z = bot.botRepositionTargetZ;
  if (x === null || x === undefined || z === null || z === undefined) {
    return null;
  }

  if (
    Math.hypot(x - bot.x, z - bot.z) <= BOT_REPOSITION_ARRIVAL_RADIUS ||
    !isBotMovePositionValid(runtime, x, z)
  ) {
    return null;
  }

  const moveX = x - bot.x;
  const moveZ = z - bot.z;
  const moveLength = Math.hypot(moveX, moveZ) || 1;
  const nextStepX = bot.x + (moveX / moveLength) * BOT_NAV_STEP_DISTANCE;
  const nextStepZ = bot.z + (moveZ / moveLength) * BOT_NAV_STEP_DISTANCE;

  if (!isBotMovePositionValid(runtime, nextStepX, nextStepZ)) {
    return null;
  }

  if (hasBotLineOfSight(runtime, bot.x, bot.z, target)) {
    return null;
  }

  return { x, z };
}

function pickBotRepositionCandidate(
  runtime: SoloRuntimeState,
  bot: PlayerRuntimeState,
  target: PlayerRuntimeState,
  candidates: Array<{ x: number; z: number }>,
  requireShotWindow: boolean
) {
  const scoredCandidates = candidates
    .filter((candidate) => isBotMovePositionValid(runtime, candidate.x, candidate.z))
    .filter((candidate) => hasImmediateBotStep(runtime, bot, candidate.x, candidate.z))
    .map((candidate) => ({
      ...candidate,
      hasShotWindow: hasBotLineOfSight(runtime, candidate.x, candidate.z, target),
      targetDistance: Math.hypot(target.x - candidate.x, target.z - candidate.z),
      travelDistance: Math.hypot(candidate.x - bot.x, candidate.z - bot.z)
    }))
    .filter((candidate) => !requireShotWindow || candidate.hasShotWindow)
    .sort((left, right) => {
      if (left.hasShotWindow !== right.hasShotWindow) {
        return left.hasShotWindow ? -1 : 1;
      }

      if (left.targetDistance !== right.targetDistance) {
        return left.targetDistance - right.targetDistance;
      }

      return left.travelDistance - right.travelDistance;
    });

  return scoredCandidates[0] ?? null;
}

function hasImmediateBotStep(
  runtime: SoloRuntimeState,
  bot: PlayerRuntimeState,
  targetX: number,
  targetZ: number
) {
  const moveX = targetX - bot.x;
  const moveZ = targetZ - bot.z;
  const moveLength = Math.hypot(moveX, moveZ) || 1;
  const nextStepX = bot.x + (moveX / moveLength) * BOT_NAV_STEP_DISTANCE;
  const nextStepZ = bot.z + (moveZ / moveLength) * BOT_NAV_STEP_DISTANCE;

  return isBotMovePositionValid(runtime, nextStepX, nextStepZ);
}

function hasBotLineOfSight(
  runtime: SoloRuntimeState,
  startX: number,
  startZ: number,
  target: PlayerRuntimeState
) {
  if (
    STATIC_ARENA_OBSTACLES.some((obstacle) =>
      segmentHitsCircle(
        startX,
        startZ,
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

  return ![...runtime.structures.values()].some((structure) => {
    if (structure.type !== "wall") {
      return false;
    }

    return segmentHitsWall(
      startX,
      startZ,
      target.x,
      target.z,
      structure.x,
      structure.z,
      structure.rotationY ?? 0
    );
  });
}
