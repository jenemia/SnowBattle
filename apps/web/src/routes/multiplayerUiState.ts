import type { MatchLifecycle } from "@snowbattle/shared";

export interface MultiplayerUiStateInput {
  hasLiveSnapshot: boolean;
  lifecycle: MatchLifecycle | null;
}

export interface MultiplayerUiState {
  showControlsGuide: boolean;
  showHero: boolean;
  showStatusCard: boolean;
  showTimerBadge: boolean;
}

export function getMultiplayerUiState(
  input: MultiplayerUiStateInput
): MultiplayerUiState {
  if (!input.hasLiveSnapshot || input.lifecycle === null) {
    return {
      showControlsGuide: false,
      showHero: true,
      showStatusCard: true,
      showTimerBadge: false
    };
  }

  if (input.lifecycle === "in_match") {
    return {
      showControlsGuide: true,
      showHero: true,
      showStatusCard: false,
      showTimerBadge: true
    };
  }

  return {
    showControlsGuide: false,
    showHero: true,
    showStatusCard: true,
    showTimerBadge: false
  };
}
