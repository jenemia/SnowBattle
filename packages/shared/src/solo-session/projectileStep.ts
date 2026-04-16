import {
  FIRE_COOLDOWN_MS,
  PROJECTILE_SPEED,
  PROJECTILE_SPAWN_DISTANCE,
  PROJECTILE_TTL_MS,
  SOLO_MAX_PACKED_SNOW,
  SOLO_PACKED_SNOW_ON_DIRECT_HIT,
  SOLO_SNOWBALL_DAMAGE,
  SOLO_SNOWBALL_LOAD,
  SOLO_SNOWBALL_RANGE,
  SOLO_STRUCTURE_COLLISION_RADIUS
} from "../constants";
import type { PlayerRuntimeState, SoloRuntimeState } from "./runtimeTypes";
import { circleIntersectsWall } from "./geometry";

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
    traveled: 0,
    vx: directionX * PROJECTILE_SPEED,
    vz: directionZ * PROJECTILE_SPEED,
    x: player.x + directionX * PROJECTILE_SPAWN_DISTANCE,
    z: player.z + directionZ * PROJECTILE_SPAWN_DISTANCE
  });
  player.fireCooldownRemaining = FIRE_COOLDOWN_MS;
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
      applyDirectHit(runtime, runtime.players[projectile.ownerSlot], target);
      runtime.projectiles.delete(projectile.id);
    }
  }
}

function applyDirectHit(
  runtime: SoloRuntimeState,
  source: PlayerRuntimeState,
  target: PlayerRuntimeState
) {
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

function findHitStructure(runtime: SoloRuntimeState, projectileX: number, projectileZ: number) {
  return [...runtime.structures.values()].find((structure) => {
    if (structure.type === "wall") {
      return circleIntersectsWall(projectileX, projectileZ, 0.28, structure.x, structure.z);
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
