import { ARENA_HALF_EXTENT } from "./constants.js";

export interface MatchRules {
  matchDurationMs: number;
  whiteoutStartMs: number;
  finalPushStartMs: number;
  whiteoutTargetRadius: number;
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  matchDurationMs: 120_000,
  whiteoutStartMs: 60_000,
  finalPushStartMs: 90_000,
  whiteoutTargetRadius: 5
};

export function validateMatchRules(rules: MatchRules): MatchRules {
  if (!Number.isFinite(rules.matchDurationMs) || rules.matchDurationMs <= 0) {
    throw new Error("matchDurationMs must be a positive number");
  }

  if (!Number.isFinite(rules.whiteoutStartMs) || rules.whiteoutStartMs <= 0) {
    throw new Error("whiteoutStartMs must be a positive number");
  }

  if (!Number.isFinite(rules.finalPushStartMs) || rules.finalPushStartMs <= 0) {
    throw new Error("finalPushStartMs must be a positive number");
  }

  if (rules.whiteoutStartMs >= rules.finalPushStartMs) {
    throw new Error("whiteoutStartMs must be earlier than finalPushStartMs");
  }

  if (rules.finalPushStartMs >= rules.matchDurationMs) {
    throw new Error("finalPushStartMs must be earlier than matchDurationMs");
  }

  if (
    !Number.isFinite(rules.whiteoutTargetRadius) ||
    rules.whiteoutTargetRadius <= 0
  ) {
    throw new Error("whiteoutTargetRadius must be a positive number");
  }

  if (rules.whiteoutTargetRadius > ARENA_HALF_EXTENT) {
    throw new Error("whiteoutTargetRadius cannot exceed the arena half extent");
  }

  return rules;
}

export function createMatchRules(
  overrides: Partial<MatchRules> = {}
): MatchRules {
  return validateMatchRules({
    ...DEFAULT_MATCH_RULES,
    ...overrides
  });
}
