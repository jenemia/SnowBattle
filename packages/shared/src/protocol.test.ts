import { describe, expect, it } from "vitest";

import { parseClientMessage } from "./validation";

describe("shared client message validation", () => {
  it("accepts a valid input snapshot", () => {
    const result = parseClientMessage("player:input", {
      sequence: 2,
      moveX: 0.25,
      moveY: -1,
      pointerAngle: Math.PI,
      fire: false
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed payloads", () => {
    const result = parseClientMessage("player:input", {
      sequence: -1,
      moveX: 99,
      moveY: "bad",
      pointerAngle: 0,
      fire: "nope"
    });

    expect(result.success).toBe(false);
  });
});
