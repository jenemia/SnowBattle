import { describe, expect, it } from "vitest";

import { MatchmakingQueue } from "./MatchmakingQueue.js";

describe("MatchmakingQueue", () => {
  it("pairs exactly two players and removes them from the waiting list", () => {
    const queue = new MatchmakingQueue<string>();
    queue.enqueue("p1");
    queue.enqueue("p2");
    queue.enqueue("p3");

    expect(queue.dequeuePair()).toEqual(["p1", "p2"]);
    expect(queue.values()).toEqual(["p3"]);
  });
});
