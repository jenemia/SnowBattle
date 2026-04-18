import { describe, expect, it } from "vitest";

import {
  createTextureUrlModifier,
  normalizeTextureRequestPath
} from "./gltfTextureUrl";

describe("gltfTextureUrl", () => {
  it("normalizes relative and absolute texture request paths", () => {
    expect(normalizeTextureRequestPath("Textures/colormap.png")).toBe(
      "Textures/colormap.png"
    );
    expect(normalizeTextureRequestPath("./Textures/colormap.png")).toBe(
      "Textures/colormap.png"
    );
    expect(
      normalizeTextureRequestPath("/SnowBattle/assets/Textures/colormap.png")
    ).toBe("Textures/colormap.png");
    expect(
      normalizeTextureRequestPath(
        "https://jenemia.github.io/SnowBattle/assets/Textures/texture-c.png?import"
      )
    ).toBe("Textures/texture-c.png");
  });

  it("rewrites github pages texture requests to emitted asset urls", () => {
    const modifier = createTextureUrlModifier(
      new Map([
        ["Textures/colormap.png", "/SnowBattle/assets/colormap-abc123.png"],
        ["Textures/texture-c.png", "/SnowBattle/assets/texture-c-def456.png"]
      ])
    );

    expect(modifier("/SnowBattle/assets/Textures/colormap.png")).toBe(
      "/SnowBattle/assets/colormap-abc123.png"
    );
    expect(
      modifier("https://jenemia.github.io/SnowBattle/assets/Textures/texture-c.png")
    ).toBe("/SnowBattle/assets/texture-c-def456.png");
    expect(modifier("/SnowBattle/assets/Textures/missing.png")).toBe(
      "/SnowBattle/assets/Textures/missing.png"
    );
  });
});
