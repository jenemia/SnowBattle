import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BLOCKY_CHARACTER_IDS,
  chooseBlockyCharacterId,
  getBlockyCharacterUrl
} from "./blockyCharacterAssets";

describe("blockyCharacterAssets", () => {
  it("tracks all 18 character GLBs", () => {
    expect(BLOCKY_CHARACTER_IDS).toHaveLength(18);
  });

  it("selects characters deterministically from guest name and slot", () => {
    expect(chooseBlockyCharacterId("You", "A")).toBe(chooseBlockyCharacterId("You", "A"));
    expect(
      new Set(
        ["You", "Bot", "Opponent", "Guest-1", "Guest-2"].map((name, index) =>
          chooseBlockyCharacterId(name, index % 2 === 0 ? "A" : "B")
        )
      ).size
    ).toBeGreaterThan(1);
  });

  it("verifies sample GLBs contain locomotion and action clips", () => {
    for (const characterId of ["character-a", "character-r"] as const) {
      const json = parseGlbJson(new URL(getBlockyCharacterUrl(characterId)));
      const animationNames = (json.animations ?? []).map((animation, index) => {
        return animation.name ?? `unnamed-${index}`;
      });

      expect(animationNames).toContain("idle");
      expect(animationNames).toContain("walk");
      expect(animationNames).toContain("holding-right-shoot");
      expect(animationNames).toContain("interact-right");
      expect(animationNames).toContain("die");
    }
  });
});

function parseGlbJson(url: URL) {
  const buffer = readFileSync(url);
  let offset = 12;
  let json: {
    animations?: Array<{ name?: string }>;
  } | null = null;

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    offset += 4;
    const chunkType = buffer.toString("utf8", offset, offset + 4);
    offset += 4;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === "JSON") {
      json = JSON.parse(chunk.toString("utf8"));
    }
  }

  if (!json) {
    throw new Error(`Missing JSON chunk in ${url.pathname}`);
  }

  return json;
}
