export interface MovementVector {
  x: number;
  y: number;
}

const KEY_BINDINGS: Record<string, MovementVector> = {
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: 0, y: -1 }
};

const CODE_BINDINGS: Record<string, string> = {
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  KeyA: "a",
  KeyD: "d",
  KeyS: "s",
  KeyW: "w"
};

export function getNormalizedMovement(keys: Iterable<string>): MovementVector {
  let x = 0;
  let y = 0;

  for (const key of keys) {
    const binding = KEY_BINDINGS[key];

    if (!binding) {
      continue;
    }

    x += binding.x;
    y += binding.y;
  }

  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length
  };
}

export function damp(current: number, target: number, lambda: number, delta: number) {
  return target + (current - target) * Math.exp(-lambda * delta);
}

export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  delta: number
) {
  let difference = target - current;

  while (difference > Math.PI) {
    difference -= Math.PI * 2;
  }

  while (difference < -Math.PI) {
    difference += Math.PI * 2;
  }

  return current + difference * (1 - Math.exp(-lambda * delta));
}

export function movementLabel(vector: MovementVector) {
  if (vector.x === 0 && vector.y === 0) {
    return "idle";
  }

  const horizontal = vector.x > 0 ? "east" : vector.x < 0 ? "west" : "";
  const vertical = vector.y > 0 ? "south" : vector.y < 0 ? "north" : "";

  return [vertical, horizontal].filter(Boolean).join("-");
}

export function normalizeMovementKey(key: string, code?: string) {
  if (code && CODE_BINDINGS[code]) {
    return CODE_BINDINGS[code];
  }

  const normalized = key.length === 1 ? key.toLowerCase() : key;

  return KEY_BINDINGS[normalized] ? normalized : null;
}
