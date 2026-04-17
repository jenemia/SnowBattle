import { SOLO_WALL_HALF_DEPTH, SOLO_WALL_HALF_WIDTH } from "../constants.js";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function circleIntersectsCircle(
  x: number,
  z: number,
  radius: number,
  circleX: number,
  circleZ: number,
  circleRadius: number
) {
  const dx = x - circleX;
  const dz = z - circleZ;
  const overlapDistance = radius + circleRadius;

  return dx * dx + dz * dz <= overlapDistance * overlapDistance;
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

export function segmentHitsCircle(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  circleX: number,
  circleZ: number,
  circleRadius: number
) {
  const steps = 8;

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const z = startZ + (endZ - startZ) * t;

    if (circleIntersectsCircle(x, z, 0.18, circleX, circleZ, circleRadius)) {
      return true;
    }
  }

  return false;
}

export function resolveCircleOutsideWall(
  x: number,
  z: number,
  radius: number,
  wallX: number,
  wallZ: number,
  wallRotationY = 0,
  margin = 0
) {
  const { x: localX, z: localZ } = rotateIntoWallSpace(x, z, wallX, wallZ, wallRotationY);
  const paddedHalfWidth = SOLO_WALL_HALF_WIDTH + radius + margin;
  const paddedHalfDepth = SOLO_WALL_HALF_DEPTH + radius + margin;

  if (Math.abs(localX) > paddedHalfWidth || Math.abs(localZ) > paddedHalfDepth) {
    return { overlapped: false, x, z };
  }

  const pushX = paddedHalfWidth - Math.abs(localX);
  const pushZ = paddedHalfDepth - Math.abs(localZ);
  const nextLocalX =
    pushX < pushZ
      ? getEscapeSign(localX, localZ) * paddedHalfWidth
      : localX;
  const nextLocalZ =
    pushX < pushZ
      ? localZ
      : getEscapeSign(localZ, localX) * paddedHalfDepth;
  const world = rotateOutOfWallSpace(
    nextLocalX,
    nextLocalZ,
    wallX,
    wallZ,
    wallRotationY
  );

  return {
    overlapped: true,
    x: world.x,
    z: world.z
  };
}

export function resolveCircleOutsideCircle(
  x: number,
  z: number,
  radius: number,
  circleX: number,
  circleZ: number,
  circleRadius: number,
  margin = 0
) {
  const deltaX = x - circleX;
  const deltaZ = z - circleZ;
  const distance = Math.hypot(deltaX, deltaZ);
  const minDistance = radius + circleRadius + margin;

  if (distance >= minDistance) {
    return { overlapped: false, x, z };
  }

  if (distance <= 1e-6) {
    return {
      overlapped: true,
      x: circleX + minDistance,
      z: circleZ
    };
  }

  const scale = minDistance / distance;

  return {
    overlapped: true,
    x: circleX + deltaX * scale,
    z: circleZ + deltaZ * scale
  };
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

function rotateOutOfWallSpace(
  localX: number,
  localZ: number,
  wallX: number,
  wallZ: number,
  wallRotationY: number
) {
  const cosine = Math.cos(wallRotationY);
  const sine = Math.sin(wallRotationY);

  return {
    x: wallX + localX * cosine - localZ * sine,
    z: wallZ + localX * sine + localZ * cosine
  };
}

function getEscapeSign(primary: number, fallback: number) {
  if (primary < 0) {
    return -1;
  }

  if (primary > 0) {
    return 1;
  }

  return fallback < 0 ? -1 : 1;
}
