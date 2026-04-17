import {
  FIRE_COOLDOWN_MS,
  PROJECTILE_SPEED,
  PROJECTILE_SPAWN_DISTANCE,
  PROJECTILE_TTL_MS,
  SOLO_MAX_PACKED_SNOW,
  SOLO_PACKED_SNOW_ON_DIRECT_HIT,
  SOLO_SNOWMAN_TURRET_LOAD,
  SOLO_SNOWBALL_DAMAGE,
  SOLO_SNOWBALL_LOAD,
  SOLO_SNOWBALL_RANGE,
  SOLO_STRUCTURE_COLLISION_RADIUS
} from "../constants.js";
import type {
  PlayerRuntimeState,
  ProjectileRuntimeState,
  SoloRuntimeState,
  StructureRuntimeState
} from "./runtimeTypes.js";
import { circleIntersectsWall } from "./geometry.js";

const TURRET_PROJECTILE_SPEED = 10;

export function trySpawnProjectile(runtime: SoloRuntimeState, player: PlayerRuntimeState) {
  if (player.fireCooldownRemaining > 0) {
    return;
  }

  const aimX = player.aimX - player.x;
  const aimZ = player.aimZ - player.z;
  const length = Math.hypot(aimX, aimZ);

  if (length < 0.001) {
    return;
  }

  const directionX = aimX / length;
  const directionZ = aimZ / length;

  runtime.projectileCounter += 1;
  const id = `${player.slot}-${runtime.projectileCounter}`;
  runtime.projectiles.set(id, {
    expiresAt: runtime.elapsedMs + PROJECTILE_TTL_MS,
    id,
    ownerSlot: player.slot,
    sourceType: "player",
    traveled: 0,
    vx: directionX * PROJECTILE_SPEED,
    vz: directionZ * PROJECTILE_SPEED,
    x: player.x + directionX * PROJECTILE_SPAWN_DISTANCE,
    z: player.z + directionZ * PROJECTILE_SPAWN_DISTANCE
  });
  player.fireCooldownRemaining = FIRE_COOLDOWN_MS;
}

export function spawnTurretProjectile(
  runtime: SoloRuntimeState,
  structure: StructureRuntimeState,
  target: PlayerRuntimeState
) {
  const aimX = target.x - structure.x;
  const aimZ = target.z - structure.z;
  const length = Math.hypot(aimX, aimZ);

  if (length < 0.001) {
    return false;
  }

  const directionX = aimX / length;
  const directionZ = aimZ / length;

  runtime.projectileCounter += 1;
  const id = `turret-${structure.ownerSlot}-${runtime.projectileCounter}`;
  runtime.projectiles.set(id, {
    expiresAt: runtime.elapsedMs + PROJECTILE_TTL_MS,
    id,
    ownerSlot: structure.ownerSlot,
    sourceType: "snowman_turret",
    traveled: 0,
    vx: directionX * TURRET_PROJECTILE_SPEED,
    vz: directionZ * TURRET_PROJECTILE_SPEED,
    x: structure.x + directionX * PROJECTILE_SPAWN_DISTANCE,
    z: structure.z + directionZ * PROJECTILE_SPAWN_DISTANCE
  });

  return true;
}

export function updateProjectiles(runtime: SoloRuntimeState, deltaSeconds: number) {
  for (const projectile of runtime.projectiles.values()) {
    projectile.x += projectile.vx * deltaSeconds;
    projectile.z += projectile.vz * deltaSeconds;
    projectile.traveled += Math.hypot(
      projectile.vx * deltaSeconds,
      projectile.vz * deltaSeconds
    );

    if (
      projectile.traveled >= SOLO_SNOWBALL_RANGE ||
      projectile.expiresAt <= runtime.elapsedMs
    ) {
      runtime.projectiles.delete(projectile.id);
      continue;
    }

    const structure = findHitStructure(runtime, projectile.x, projectile.z);
    if (structure) {
      structure.hp = Math.max(0, structure.hp - SOLO_SNOWBALL_DAMAGE);
      runtime.projectiles.delete(projectile.id);
      continue;
    }

    const target = runtime.players[projectile.ownerSlot === "A" ? "B" : "A"];
    if (Math.hypot(projectile.x - target.x, projectile.z - target.z) <= 1.2) {
      applyProjectileHit(runtime, projectile, target);
      runtime.projectiles.delete(projectile.id);
    }
  }
}

function applyProjectileHit(
  runtime: SoloRuntimeState,
  projectile: ProjectileRuntimeState,
  target: PlayerRuntimeState
) {
  if (projectile.sourceType === "snowman_turret") {
    applyTurretHit(runtime, target);
    return;
  }

  const source = runtime.players[projectile.ownerSlot];

  target.hp = Math.max(0, target.hp - SOLO_SNOWBALL_DAMAGE);
  target.snowLoad = Math.min(100, target.snowLoad + SOLO_SNOWBALL_LOAD);
  target.lastHitAt = runtime.elapsedMs;
  target.slowMultiplier = 1 - getSlowPenalty(target.snowLoad);
  source.packedSnow = Math.min(
    SOLO_MAX_PACKED_SNOW,
    source.packedSnow + SOLO_PACKED_SNOW_ON_DIRECT_HIT
  );
  source.totalDirectDamageDealt += SOLO_SNOWBALL_DAMAGE;
}

function applyTurretHit(runtime: SoloRuntimeState, target: PlayerRuntimeState) {
  target.snowLoad = Math.min(100, target.snowLoad + SOLO_SNOWMAN_TURRET_LOAD);
  target.lastHitAt = runtime.elapsedMs;
  target.slowMultiplier = 1 - getSlowPenalty(target.snowLoad);
}

function findHitStructure(runtime: SoloRuntimeState, projectileX: number, projectileZ: number) {
  return [...runtime.structures.values()].find((structure) => {
    if (structure.type === "wall") {
      return circleIntersectsWall(
        projectileX,
        projectileZ,
        0.28,
        structure.x,
        structure.z,
        structure.rotationY ?? 0
      );
    }

    return (
      Math.hypot(structure.x - projectileX, structure.z - projectileZ) <=
      SOLO_STRUCTURE_COLLISION_RADIUS
    );
  });
}

function getSlowPenalty(snowLoad: number) {
  return Math.min(0.35, (snowLoad / 20) * 0.07);
}
