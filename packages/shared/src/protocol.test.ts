import { describe, expect, it } from "vitest";

import { parseClientMessage } from "./validation.js";

describe("shared client message validation", () => {
  it("accepts a valid session command", () => {
    const result = parseClientMessage("session:command", {
      type: "input:update",
      payload: {
        aimX: 6,
        aimY: -4,
        moveX: 0.25,
        moveY: -1,
        pointerActive: true
      }
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed payloads", () => {
    const result = parseClientMessage("session:command", {
      type: "input:update",
      payload: {
        aimX: 0,
        aimY: 0,
        moveX: 99,
        moveY: "bad",
        pointerActive: "nope"
      }
    });

    expect(result.success).toBe(false);
  });
});
