import { describe, expect, it } from "vitest";

import {
  buildReturnPortalUrl,
  buildVibeJamPortalUrl,
  createPortalContextFromUrl,
  getCanonicalGameUrl,
  isPlayerInsidePortal,
  RETURN_PORTAL_POSITION,
  VIBE_JAM_PORTAL_URL
} from "./portalHelpers";

describe("portalHelpers", () => {
  it("parses portal arrival context from the current url", () => {
    expect(
      createPortalContextFromUrl(
        "https://snowbattle.example/solo?portal=true&ref=https%3A%2F%2Fref.example&username=Neo&color=green&speed=9.5"
      )
    ).toEqual({
      color: "green",
      isPortalArrival: true,
      ref: "https://ref.example",
      speed: 9.5,
      username: "Neo"
    });
  });

  it("strips portal transport params from the canonical game url", () => {
    expect(
      getCanonicalGameUrl(
        "https://snowbattle.example/solo?portal=true&ref=https%3A%2F%2Fref.example&foo=bar&speed=9.5"
      )
    ).toBe("https://snowbattle.example/solo?foo=bar");
  });

  it("builds a return portal url from a relative ref path", () => {
    const url = new URL(
      buildReturnPortalUrl({
        currentGameUrl: "https://jenemia.github.io/SnowBattle/",
        ref: "/SnowBattle/",
        username: "Aurora Fox"
      })
    );

    expect(url.origin + url.pathname).toBe("https://jenemia.github.io/SnowBattle/");
    expect(url.searchParams.get("portal")).toBe("true");
    expect(url.searchParams.get("ref")).toBe("https://jenemia.github.io/SnowBattle/");
    expect(url.searchParams.get("username")).toBe("Aurora Fox");
  });

  it("falls back to the current game url when the return ref is malformed", () => {
    const url = new URL(
      buildReturnPortalUrl({
        currentGameUrl: "https://jenemia.github.io/SnowBattle/",
        ref: ":::not-a-valid-url:::",
        username: "Aurora Fox"
      })
    );

    expect(url.origin + url.pathname).toBe("https://jenemia.github.io/SnowBattle/");
    expect(url.searchParams.get("portal")).toBe("true");
    expect(url.searchParams.get("ref")).toBe("https://jenemia.github.io/SnowBattle/");
  });

  it("builds the vibejam exit portal redirect", () => {
    const url = new URL(
      buildVibeJamPortalUrl({
        color: "#72df49",
        currentGameUrl: "https://snowbattle.example/",
        speed: 9,
        username: "Aurora Fox"
      })
    );

    expect(url.origin + url.pathname).toBe(VIBE_JAM_PORTAL_URL);
    expect(url.searchParams.get("ref")).toBe("https://snowbattle.example/");
    expect(url.searchParams.get("username")).toBe("Aurora Fox");
    expect(url.searchParams.get("color")).toBe("#72df49");
    expect(url.searchParams.get("speed")).toBe("9.00");
  });

  it("builds a return portal url that preserves the portal handoff", () => {
    const url = new URL(
      buildReturnPortalUrl({
        color: "green",
        currentGameUrl: "https://snowbattle.example/",
        ref: "https://previous.example/play?seed=7",
        speed: 8.5,
        username: "Aurora Fox"
      })
    );

    expect(url.origin + url.pathname).toBe("https://previous.example/play");
    expect(url.searchParams.get("seed")).toBe("7");
    expect(url.searchParams.get("portal")).toBe("true");
    expect(url.searchParams.get("ref")).toBe("https://snowbattle.example/");
    expect(url.searchParams.get("username")).toBe("Aurora Fox");
    expect(url.searchParams.get("color")).toBe("green");
    expect(url.searchParams.get("speed")).toBe("8.50");
  });

  it("detects when the local player overlaps a portal trigger radius", () => {
    expect(isPlayerInsidePortal({ x: RETURN_PORTAL_POSITION.x, z: RETURN_PORTAL_POSITION.z }, RETURN_PORTAL_POSITION)).toBe(true);
    expect(
      isPlayerInsidePortal(
        {
          x: RETURN_PORTAL_POSITION.x + 4,
          z: RETURN_PORTAL_POSITION.z + 4
        },
        RETURN_PORTAL_POSITION
      )
    ).toBe(false);
  });
});
