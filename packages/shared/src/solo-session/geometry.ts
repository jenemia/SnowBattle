import { SOLO_WALL_HALF_DEPTH, SOLO_WALL_HALF_WIDTH } from "../constants.js";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function circleIntersectsWall(
  x: number,
  z: number,
  radius: number,
  wallX: number,
  wallZ: number,
  wallRotationY = 0
) {
  const { x: localX, z: localZ } = rotateIntoWallSpace(x, z, wallX, wallZ, wallRotationY);
  const closestX = clamp(localX, -SOLO_WALL_HALF_WIDTH, SOLO_WALL_HALF_WIDTH);
  const closestZ = clamp(localZ, -SOLO_WALL_HALF_DEPTH, SOLO_WALL_HALF_DEPTH);
  const dx = localX - closestX;
  const dz = localZ - closestZ;

  return dx * dx + dz * dz <= radius * radius;
}

export function segmentHitsWall(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  wallX: number,
  wallZ: number,
  wallRotationY = 0
) {
  const steps = 8;

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const z = startZ + (endZ - startZ) * t;

    if (circleIntersectsWall(x, z, 0.18, wallX, wallZ, wallRotationY)) {
      return true;
    }
  }

  return false;
}

function rotateIntoWallSpace(
  x: number,
  z: number,
  wallX: number,
  wallZ: number,
  wallRotationY: number
) {
  const deltaX = x - wallX;
  const deltaZ = z - wallZ;
  const cosine = Math.cos(wallRotationY);
  const sine = Math.sin(wallRotationY);

  return {
    x: deltaX * cosine + deltaZ * sine,
    z: -deltaX * sine + deltaZ * cosine
  };
}
