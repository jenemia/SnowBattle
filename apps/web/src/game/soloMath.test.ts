import { describe, expect, it } from "vitest";

import { getNormalizedMovement, movementLabel, normalizeMovementKey } from "./soloMath";

describe("solo movement math", () => {
  it("normalizes diagonal movement", () => {
    const vector = getNormalizedMovement(["w", "d"]);

    expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1, 5);
    expect(vector.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(vector.y).toBeCloseTo(-Math.SQRT1_2, 5);
  });

  it("reports idle correctly", () => {
    const vector = getNormalizedMovement([]);

    expect(vector).toEqual({ x: 0, y: 0 });
    expect(movementLabel(vector)).toBe("idle");
  });

  it("normalizes uppercase input keys", () => {
    expect(normalizeMovementKey("W")).toBe("w");
    expect(normalizeMovementKey("ArrowLeft")).toBe("ArrowLeft");
    expect(normalizeMovementKey("Shift")).toBeNull();
  });
});
