import { describe, expect, it } from "vitest";

import { circleIntersectsWall, segmentHitsWall } from "./geometry.js";

describe("solo-session geometry", () => {
  it("detects circle overlap against wall bounds", () => {
    expect(circleIntersectsWall(0, 0, 0.5, 0, 0)).toBe(true);
    expect(circleIntersectsWall(5, 5, 0.3, 0, 0)).toBe(false);
  });

  it("detects line of sight blockage through a wall", () => {
    expect(segmentHitsWall(0, 5, 0, -5, 0, 0)).toBe(true);
    expect(segmentHitsWall(-5, 5, -5, -5, 0, 0)).toBe(false);
  });
});
