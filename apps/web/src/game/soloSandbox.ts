export interface GroundIntersection {
  x: number;
  z: number;
}

export interface RayLike {
  direction: {
    x: number;
    y: number;
    z: number;
  };
  origin: {
    x: number;
    y: number;
    z: number;
  };
}

export interface WallFootprint {
  halfDepth: number;
  halfWidth: number;
  x: number;
  z: number;
}

export interface WallPlacementInput {
  arenaBounds: number;
  halfDepth: number;
  halfWidth: number;
  playerRadius: number;
  playerX: number;
  playerZ: number;
  walls: WallFootprint[];
  x: number;
  z: number;
}

export class IndexPool {
  private readonly freeIndices: number[];
  private activeCountValue = 0;

  constructor(private readonly capacity: number) {
    this.freeIndices = Array.from({ length: capacity }, (_, index) => capacity - index - 1);
  }

  acquire() {
    const index = this.freeIndices.pop();

    if (index === undefined) {
      return null;
    }

    this.activeCountValue += 1;
    return index;
  }

  release(index: number) {
    this.freeIndices.push(index);
    this.activeCountValue = Math.max(0, this.activeCountValue - 1);
  }

  get activeCount() {
    return this.activeCountValue;
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function circleIntersectsAabb(
  x: number,
  z: number,
  radius: number,
  wallX: number,
  wallZ: number,
  halfWidth: number,
  halfDepth: number
) {
  const closestX = clamp(x, wallX - halfWidth, wallX + halfWidth);
  const closestZ = clamp(z, wallZ - halfDepth, wallZ + halfDepth);
  const dx = x - closestX;
  const dz = z - closestZ;

  return dx * dx + dz * dz <= radius * radius;
}

export function intersectRayWithGround(ray: RayLike): GroundIntersection | null {
  const { direction, origin } = ray;

  if (Math.abs(direction.y) < 1e-6) {
    return null;
  }

  const t = -origin.y / direction.y;

  if (t < 0) {
    return null;
  }

  return {
    x: origin.x + direction.x * t,
    z: origin.z + direction.z * t
  };
}

export function isWallPlacementValid(input: WallPlacementInput) {
  const placement = {
    halfDepth: input.halfDepth,
    halfWidth: input.halfWidth,
    x: input.x,
    z: input.z
  };

  const withinArena =
    placement.x - placement.halfWidth >= -input.arenaBounds &&
    placement.x + placement.halfWidth <= input.arenaBounds &&
    placement.z - placement.halfDepth >= -input.arenaBounds &&
    placement.z + placement.halfDepth <= input.arenaBounds;

  if (!withinArena) {
    return false;
  }

  if (
    circleIntersectsAabb(
      input.playerX,
      input.playerZ,
      input.playerRadius,
      placement.x,
      placement.z,
      placement.halfWidth,
      placement.halfDepth
    )
  ) {
    return false;
  }

  return !input.walls.some((wall) => wallsOverlap(wall, placement));
}

export function stepDurability(current: number) {
  return Math.max(0, current - 1);
}

function wallsOverlap(a: WallFootprint, b: WallFootprint) {
  return (
    Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth &&
    Math.abs(a.z - b.z) < a.halfDepth + b.halfDepth
  );
}
