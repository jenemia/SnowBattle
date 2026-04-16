import { describe, expect, it } from "vitest";

import { getMultiplayerUiState } from "./multiplayerUiState";

describe("getMultiplayerUiState", () => {
  it("keeps the queue surface visible until a live snapshot exists", () => {
    expect(
      getMultiplayerUiState({
        hasLiveSnapshot: false,
        hostname: "snowbattle.fly.dev",
        lifecycle: null
      })
    ).toEqual({
      showDebugPanel: false,
      showHero: true,
      showProdSkillStrip: false,
      showQueuePanel: true
    });
  });

  it("keeps the queue surface visible through waiting and countdown snapshots", () => {
    for (const lifecycle of ["waiting", "countdown"] as const) {
      expect(
        getMultiplayerUiState({
          hasLiveSnapshot: true,
          hostname: "localhost",
          lifecycle
        })
      ).toEqual({
        showDebugPanel: false,
        showHero: true,
        showProdSkillStrip: false,
        showQueuePanel: true
      });
    }
  });

  it("shows the local debug panel during live matches on localhost", () => {
    expect(
      getMultiplayerUiState({
        hasLiveSnapshot: true,
        hostname: "127.0.0.1",
        lifecycle: "in_match"
      })
    ).toEqual({
      showDebugPanel: true,
      showHero: false,
      showProdSkillStrip: false,
      showQueuePanel: false
    });
  });

  it("shows the compact prod strip during live matches on deployed hosts", () => {
    expect(
      getMultiplayerUiState({
        hasLiveSnapshot: true,
        hostname: "jenemia.github.io",
        lifecycle: "in_match"
      })
    ).toEqual({
      showDebugPanel: false,
      showHero: false,
      showProdSkillStrip: true,
      showQueuePanel: false
    });
  });

  it("returns to the queue panel once a match is finished", () => {
    expect(
      getMultiplayerUiState({
        hasLiveSnapshot: true,
        hostname: "localhost",
        lifecycle: "finished"
      })
    ).toEqual({
      showDebugPanel: false,
      showHero: false,
      showProdSkillStrip: false,
      showQueuePanel: true
    });
  });
});
