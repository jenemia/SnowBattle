import { describe, expect, it } from "vitest";

import { ARENA_HALF_EXTENT } from "./constants.js";
import {
  DEFAULT_MATCH_RULES,
  createMatchRules,
  validateMatchRules
} from "./matchRules.js";

describe("matchRules", () => {
  it("merges partial overrides with the default rules", () => {
    expect(
      createMatchRules({
        finalPushStartMs: 80_000
      })
    ).toEqual({
      ...DEFAULT_MATCH_RULES,
      finalPushStartMs: 80_000
    });
  });

  it("rejects invalid match rule ordering", () => {
    expect(() =>
      createMatchRules({
        finalPushStartMs: DEFAULT_MATCH_RULES.whiteoutStartMs
      })
    ).toThrow("whiteoutStartMs must be earlier than finalPushStartMs");
  });

  it("rejects whiteout radii outside the arena", () => {
    expect(() =>
      validateMatchRules({
        ...DEFAULT_MATCH_RULES,
        whiteoutTargetRadius: ARENA_HALF_EXTENT + 1
      })
    ).toThrow("whiteoutTargetRadius cannot exceed the arena half extent");
  });
});
