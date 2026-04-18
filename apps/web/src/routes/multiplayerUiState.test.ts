import { describe, expect, it } from "vitest";

import { getMultiplayerUiState } from "./multiplayerUiState";

describe("getMultiplayerUiState", () => {
  it("keeps the status card visible until a live snapshot exists", () => {
    expect(
      getMultiplayerUiState({
        hasLiveSnapshot: false,
        lifecycle: null
      })
    ).toEqual({
      showControlsGuide: false,
      showHero: true,
      showStatusCard: true,
      showTimerBadge: false
    });
  });

  it("keeps the status card visible through waiting and countdown snapshots", () => {
    for (const lifecycle of ["waiting", "countdown"] as const) {
      expect(
        getMultiplayerUiState({
          hasLiveSnapshot: true,
          lifecycle
        })
      ).toEqual({
        showControlsGuide: false,
        showHero: true,
        showStatusCard: true,
        showTimerBadge: false
      });
    }
  });

  it("shows only the guide card and timer during live matches", () => {
    expect(
      getMultiplayerUiState({
        hasLiveSnapshot: true,
        lifecycle: "in_match"
      })
    ).toEqual({
      showControlsGuide: true,
      showHero: true,
      showStatusCard: false,
      showTimerBadge: true
    });
  });

  it("returns to the status card once a match is finished", () => {
    expect(
      getMultiplayerUiState({
        hasLiveSnapshot: true,
        lifecycle: "finished"
      })
    ).toEqual({
      showControlsGuide: false,
      showHero: true,
      showStatusCard: true,
      showTimerBadge: false
    });
  });
});
