import { SOLO_WALL_HALF_DEPTH, SOLO_WALL_HALF_WIDTH } from "../constants.js";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function circleIntersectsWall(
  x: number,
  z: number,
  radius: number,
  wallX: number,
  wallZ: number
) {
  const closestX = clamp(x, wallX - SOLO_WALL_HALF_WIDTH, wallX + SOLO_WALL_HALF_WIDTH);
  const closestZ = clamp(z, wallZ - SOLO_WALL_HALF_DEPTH, wallZ + SOLO_WALL_HALF_DEPTH);
  const dx = x - closestX;
  const dz = z - closestZ;

  return dx * dx + dz * dz <= radius * radius;
}

export function segmentHitsWall(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  wallX: number,
  wallZ: number
) {
  const steps = 8;

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const z = startZ + (endZ - startZ) * t;

    if (circleIntersectsWall(x, z, 0.18, wallX, wallZ)) {
      return true;
    }
  }

  return false;
}
