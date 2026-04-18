import { describe, expect, it } from "vitest";

import { STATIC_ARENA_OBSTACLES } from "../staticObstacles.js";
import { updateBot } from "./botStep.js";
import { createInitialState } from "./createInitialState.js";
import { updatePlayers } from "./playerStep.js";

describe("solo bot shot windows", () => {
  it("keeps the existing immediate shot when the player is unobstructed", () => {
    const runtime = createInitialState({ botEnabled: true });
    const bot = runtime.players.B;
    const target = runtime.players.A;

    target.x = 0;
    target.z = 0;
    bot.x = 0;
    bot.z = -8;

    updateBot(runtime, bot, target, "standard", 22);

    expect(runtime.projectiles.size).toBe(1);
  });

  it("repositions around a static obstacle before firing", () => {
    const runtime = createInitialState({ botEnabled: true });
    const bot = runtime.players.B;
    const target = runtime.players.A;
    const obstacle = STATIC_ARENA_OBSTACLES[0];
    const startingBotX = obstacle.x - obstacle.blockingRadius - 2.5;
    const startingBotZ = obstacle.z;

    target.x = obstacle.x + obstacle.blockingRadius + 2.5;
    target.z = obstacle.z;
    bot.x = startingBotX;
    bot.z = obstacle.z;

    updateBot(runtime, bot, target, "standard", 22);

    expect(runtime.projectiles.size).toBe(0);
    expect(bot.moveZ).not.toBeCloseTo(0, 5);

    let sawAttack = false;

    let furthestZ = bot.z;

    for (let elapsedMs = 0; elapsedMs < 4_000; elapsedMs += 50) {
      runtime.elapsedMs += 50;
      updatePlayers(runtime, 50, "standard", 22);
      updateBot(runtime, bot, target, "standard", 22);
      furthestZ = Math.max(furthestZ, bot.z);

      if (runtime.projectiles.size > 0) {
        sawAttack = true;
        break;
      }
    }

    expect(bot.z).not.toBeCloseTo(startingBotZ, 5);
    expect(furthestZ).toBeGreaterThan(startingBotZ + 3);
    expect(sawAttack).toBe(true);
  });
});
