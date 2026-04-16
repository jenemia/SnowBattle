import type { MatchLifecycle } from "@snowbattle/shared";

export interface MultiplayerUiStateInput {
  hasLiveSnapshot: boolean;
  hostname: string;
  lifecycle: MatchLifecycle | null;
}

export interface MultiplayerUiState {
  showDebugPanel: boolean;
  showHero: boolean;
  showProdSkillStrip: boolean;
  showQueuePanel: boolean;
}

export function getMultiplayerUiState(
  input: MultiplayerUiStateInput
): MultiplayerUiState {
  if (!input.hasLiveSnapshot || input.lifecycle === null) {
    return {
      showDebugPanel: false,
      showHero: true,
      showProdSkillStrip: false,
      showQueuePanel: true
    };
  }

  if (input.lifecycle === "waiting" || input.lifecycle === "countdown") {
    return {
      showDebugPanel: false,
      showHero: true,
      showProdSkillStrip: false,
      showQueuePanel: true
    };
  }

  if (input.lifecycle === "finished") {
    return {
      showDebugPanel: false,
      showHero: false,
      showProdSkillStrip: false,
      showQueuePanel: true
    };
  }

  const isLocalHost = isLocalMultiplayerHost(input.hostname);
  return {
    showDebugPanel: false,
    showHero: false,
    showProdSkillStrip: !isLocalHost,
    showQueuePanel: false
  };
}

export function isLocalMultiplayerHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
}
