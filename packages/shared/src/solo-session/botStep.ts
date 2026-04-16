import { SOLO_BONFIRE_RADIUS, SOLO_SNOWBALL_RANGE } from "../constants";
import type { MatchPhase } from "../session";
import { trySpawnProjectile } from "./projectileStep";
import type { PlayerRuntimeState, SoloRuntimeState } from "./runtimeTypes";

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

  if (distance <= SOLO_SNOWBALL_RANGE && bot.fireCooldownRemaining <= 0) {
    trySpawnProjectile(runtime, bot);
  }
}
