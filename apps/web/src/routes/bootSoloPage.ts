import {
  PLAYER_SPEED,
  type SessionProviderEvent,
  type SessionSnapshot,
  type SessionStatusCode
} from "@snowbattle/shared";

import type { SoloArenaSceneOptions } from "../game/SoloArenaScene";
import { ColyseusSessionProvider } from "../providers/ColyseusSessionProvider";
import { LocalSoloProvider } from "../providers/LocalSoloProvider";
import { getProductionServerUrl, resolveServerUrl } from "../serverUrl";
import {
  buildReturnPortalUrl,
  buildVibeJamPortalUrl,
  createPortalContextFromUrl,
  getCanonicalGameUrl,
  isPlayerInsidePortal,
  EXIT_PORTAL_POSITION,
  RETURN_PORTAL_POSITION
} from "./solo-page/portalHelpers";
import {
  mountGameSession,
  mountPredictedDuelSession,
  presentDuelHud,
  presentSoloHud,
  renderSessionHud,
  renderSoloPage
} from "./solo-page";

type HybridShellState =
  | "solo_active"
  | "queue_searching"
  | "duel_active"
  | "duel_result";

interface QueueStatusState {
  countdownMs: number | null;
  detail: string;
  message: string;
  opponentGuestName: string | null;
  position: number | null;
  queuedPlayers: number | null;
  roomId: string | null;
  statusCode: SessionStatusCode;
  statusStage: string;
}

export function bootSoloPage(root: HTMLDivElement) {
  const ui = renderSoloPage(root);
  const backendConfig = resolveServerUrl({
    explicitUrl: import.meta.env.VITE_SERVER_URL,
    hostname: window.location.hostname,
    isProduction: import.meta.env.PROD
  });
  const portalContext = createPortalContextFromUrl(window.location.href);
  const currentGameUrl = getCanonicalGameUrl(window.location.href);
  const guestName = resolveGuestName(portalContext.username);
  const hasReturnPortal = portalContext.isPortalArrival && portalContext.ref !== null;
  const soloSceneOptions = createSoloSceneOptions(hasReturnPortal);
  let soloProvider = new LocalSoloProvider();
  let queueProvider: ColyseusSessionProvider | null = null;
  let latestSoloSnapshot: SessionSnapshot | null = null;
  let latestDuelSnapshot: SessionSnapshot | null = null;
  let lastSoloHud: ReturnType<typeof presentSoloHud> | null = null;
  let lastDuelHud: ReturnType<typeof presentDuelHud> | null = null;
  let soloTeardown: (() => void) | null = null;
  let duelTeardown: (() => void) | null = null;
  let shellState: HybridShellState = "solo_active";
  let redirectingPortal = false;
  let queueSessionToken = 0;
  const queueState = createInitialQueueState();
  const queueUnsubscribers = new Set<() => void>();

  localStorage.setItem("snowbattle.guestName", guestName);
  ui.portalCopy.hidden = true;
  ui.portalCopy.textContent =
    hasReturnPortal
      ? "Return portal is live in the far corner. Step in to go back."
      : "";
  setTextIfChanged(ui.localName, guestName);
  setTextIfChanged(ui.room, "local-solo");
  setTextIfChanged(ui.queueStatusCode, queueState.statusCode);
  setTextIfChanged(ui.queueStatusStage, queueState.statusStage);

  mountSoloSurface(false);
  refreshChrome();
  syncQueueControls();

  ui.queueToggle.addEventListener("click", () => {
    if (queueProvider) {
      void cancelQueue();
      return;
    }

    void startQueue();
  });

  ui.reset.addEventListener("click", () => {
    mountSoloSurface(true);
  });

  ui.queueAgain.addEventListener("click", () => {
    void leaveDuelAndReturnToSolo(true);
  });

  ui.backToSolo.addEventListener("click", () => {
    void leaveDuelAndReturnToSolo(false);
  });

  function mountSoloSurface(freshProvider: boolean) {
    duelTeardown?.();
    duelTeardown = null;
    soloTeardown?.();
    soloTeardown = null;

    if (freshProvider) {
      soloProvider = new LocalSoloProvider();
      latestSoloSnapshot = null;
      lastSoloHud = null;
    }

    const provider = soloProvider;

    soloTeardown = mountGameSession({
      autoConnect: true,
      onSnapshot: (snapshot) => {
        latestSoloSnapshot = snapshot;
        updateMetricNodes(snapshot);
        maybeTriggerPortal(snapshot);

        if (shellState === "solo_active" || shellState === "queue_searching") {
          applySoloChrome(snapshot);
        }
      },
      provider,
      sceneOptions: soloSceneOptions,
      viewport: ui.viewport
    });
  }

  async function startQueue() {
    if (queueProvider) {
      return;
    }

    if (!backendConfig.isConfigured) {
      queueState.statusCode = "error";
      queueState.statusStage = "config";
      queueState.detail = backendConfig.statusDetail;
      queueState.message = getMissingBackendMessage(
        backendConfig.reason === "production_missing"
          ? "production_missing"
          : "host_missing"
      );
      refreshChrome();
      syncQueueControls();
      return;
    }

    shellState = "queue_searching";
    resetQueueState(queueState);
    queueState.statusCode = "connecting";
    queueState.statusStage = "connect";
    queueState.message = "Queue request started. Solo stays live until match starts.";
    queueState.detail = backendConfig.statusDetail;

    const provider = new ColyseusSessionProvider(backendConfig.serverUrl, () => {
      return localStorage.getItem("snowbattle.guestName") || guestName;
    });
    const sessionToken = ++queueSessionToken;
    queueProvider = provider;

    queueUnsubscribers.add(
      provider.subscribeEvent((event) => {
        if (sessionToken !== queueSessionToken) {
          return;
        }

        applyQueueEvent(event, queueState);

        if (event.type === "match_found") {
          activateDuel(provider, sessionToken);
        } else if (
          event.type === "status" &&
          event.code === "disconnected" &&
          shellState === "queue_searching"
        ) {
          void cancelQueue(false);
          return;
        }

        refreshChrome();
        syncQueueControls();
      })
    );

    queueUnsubscribers.add(
      provider.subscribe((snapshot) => {
        if (sessionToken !== queueSessionToken) {
          return;
        }

        latestDuelSnapshot = snapshot;

        if (
          shellState === "queue_searching" &&
          snapshot.match.lifecycle !== "waiting"
        ) {
          activateDuel(provider, sessionToken);
        }
      })
    );

    refreshChrome();
    syncQueueControls();

    try {
      await provider.connect();
    } catch (error) {
      if (sessionToken !== queueSessionToken) {
        return;
      }

      queueState.statusCode = "error";
      queueState.statusStage = "connect";
      queueState.detail = formatError(error);
      queueState.message = "Duel queue failed to connect.";
      queueProvider = null;
      queueSessionToken += 1;
      clearQueueSubscriptions();
      resetQueueState(queueState, {
        detail: queueState.detail,
        message: queueState.message,
        statusCode: "error",
        statusStage: "connect"
      });
      shellState = "solo_active";
      refreshChrome();
      syncQueueControls();
    }
  }

  async function cancelQueue(triggerDisconnect = true) {
    const provider = queueProvider;
    queueProvider = null;
    queueSessionToken += 1;
    clearQueueSubscriptions();
    latestDuelSnapshot = null;
    lastDuelHud = null;

    if (triggerDisconnect && provider) {
      await provider.disconnect();
    }

    resetQueueState(queueState);
    shellState = "solo_active";
    refreshChrome();
    syncQueueControls();
  }

  function activateDuel(provider: ColyseusSessionProvider, sessionToken: number) {
    if (
      sessionToken !== queueSessionToken ||
      shellState === "duel_active" ||
      shellState === "duel_result"
    ) {
      return;
    }

    shellState = "duel_active";
    latestDuelSnapshot = provider.getLatestSnapshot();
    lastDuelHud = null;

    soloTeardown?.();
    soloTeardown = null;
    duelTeardown?.();
    duelTeardown = null;

    duelTeardown = mountPredictedDuelSession({
      autoConnect: false,
      onSnapshot: (snapshot) => {
        latestDuelSnapshot = snapshot;
        updateMetricNodes(snapshot);
        applyDuelChrome(snapshot);

        if (snapshot.hud.result !== null || snapshot.match.lifecycle === "finished") {
          shellState = "duel_result";
          syncQueueControls();
        }
      },
      provider,
      sceneOptions: {
        portals: {
          showExitPortal: false,
          showReturnPortal: false
        }
      },
      viewport: ui.viewport
    });

    refreshChrome();
    syncQueueControls();
  }

  async function leaveDuelAndReturnToSolo(startQueueAfter: boolean) {
    duelTeardown?.();
    duelTeardown = null;
    lastDuelHud = null;
    latestDuelSnapshot = null;

    await cancelQueue(false);
    mountSoloSurface(false);

    if (startQueueAfter) {
      await startQueue();
    }
  }

  function maybeTriggerPortal(snapshot: SessionSnapshot) {
    if (redirectingPortal || shellState === "duel_active" || shellState === "duel_result") {
      return;
    }

    if (isPlayerInsidePortal(snapshot.localPlayer, EXIT_PORTAL_POSITION)) {
      redirectingPortal = true;
      window.location.href = buildVibeJamPortalUrl({
        color: portalContext.color ?? "#72df49",
        currentGameUrl,
        speed: portalContext.speed ?? PLAYER_SPEED,
        username: guestName
      });
      return;
    }

    if (hasReturnPortal && isPlayerInsidePortal(snapshot.localPlayer, RETURN_PORTAL_POSITION)) {
      redirectingPortal = true;
      window.location.href = buildReturnPortalUrl({
        color: portalContext.color ?? "#72df49",
        currentGameUrl,
        ref: portalContext.ref!,
        speed: portalContext.speed ?? PLAYER_SPEED,
        username: guestName
      });
    }
  }

  function refreshChrome() {
    if (
      (shellState === "duel_active" || shellState === "duel_result") &&
      latestDuelSnapshot
    ) {
      applyDuelChrome(latestDuelSnapshot);
      return;
    }

    if (latestSoloSnapshot) {
      applySoloChrome(latestSoloSnapshot);
      return;
    }

    ui.mode.textContent = "Solo sandbox";
    ui.roster.textContent = `${guestName} vs Bot`;
    ui.queueMeta.textContent = getQueueMetaText(queueState, backendConfig.isConfigured);
    ui.readout.textContent = "Booting local solo sandbox.";
    setTextIfChanged(ui.queueStatusCode, queueState.statusCode);
    setTextIfChanged(ui.queueStatusStage, queueState.statusStage);
  }

  function applySoloChrome(snapshot: SessionSnapshot) {
    const hud = presentSoloHud(snapshot);

    renderSessionHud(
      {
        readout: ui.readout,
        result: ui.result,
        status: ui.status,
        timerBadge: ui.timerBadge
      },
      hud,
      lastSoloHud
    );
    lastSoloHud = hud;

    ui.mode.textContent =
      shellState === "queue_searching" ? "Solo sandbox · Duel queue live" : "Solo sandbox";
    ui.roster.textContent = `${guestName} vs ${snapshot.opponentPlayer.guestName}`;
    ui.queueMeta.textContent = getQueueMetaText(queueState, backendConfig.isConfigured);
    ui.resultActions.hidden = true;
    ui.portalCopy.hidden = !hasReturnPortal;
    ui.portalCopy.textContent = hasReturnPortal
      ? "Return portal is live in the far corner. Step in to go back."
      : "";
    setTextIfChanged(ui.queueStatusCode, queueState.statusCode);
    setTextIfChanged(ui.queueStatusStage, queueState.statusStage);
  }

  function applyDuelChrome(snapshot: SessionSnapshot) {
    const hud = presentDuelHud(snapshot);

    renderSessionHud(
      {
        readout: ui.readout,
        result: ui.result,
        status: ui.status,
        timerBadge: ui.timerBadge
      },
      hud,
      lastDuelHud
    );
    lastDuelHud = hud;

    ui.mode.textContent =
      shellState === "duel_result" ? "Duel result" : "Live duel";
    ui.roster.textContent = `${snapshot.localPlayer.guestName} vs ${snapshot.opponentPlayer.guestName}`;
    ui.queueMeta.textContent = getDuelMetaText(snapshot, queueState);
    ui.resultActions.hidden = shellState !== "duel_result";
    ui.portalCopy.hidden = true;
    setTextIfChanged(ui.queueStatusCode, queueState.statusCode);
    setTextIfChanged(ui.queueStatusStage, queueState.statusStage);
  }

  function syncQueueControls() {
    const duelVisible = shellState === "duel_active" || shellState === "duel_result";

    ui.queueToggle.hidden = duelVisible;
    ui.reset.hidden = duelVisible;
    ui.resultActions.hidden = shellState !== "duel_result";
    ui.queueAgain.disabled = !backendConfig.isConfigured;
    ui.backToSolo.disabled = false;

    if (!duelVisible) {
      ui.reset.disabled = latestSoloSnapshot?.hud.result === null;
      ui.queueToggle.disabled = !backendConfig.isConfigured && queueProvider === null;
      ui.queueToggle.textContent = queueProvider
        ? "Cancel duel queue"
        : "Queue for duel";
    }
  }

  function updateMetricNodes(snapshot: SessionSnapshot) {
    setTextIfChanged(ui.phase, snapshot.match.phase);
    setTextIfChanged(ui.lifecycle, snapshot.match.lifecycle);
    setTextIfChanged(ui.localName, snapshot.localPlayer.guestName);
    setTextIfChanged(ui.opponentName, snapshot.opponentPlayer.guestName);
    setTextIfChanged(
      ui.time,
      String(Math.max(0, Math.ceil(snapshot.match.timeRemainingMs / 1000)))
    );
    setTextIfChanged(ui.hp, String(Math.round(snapshot.localPlayer.hp)));
    setTextIfChanged(ui.packedSnow, String(Math.round(snapshot.localPlayer.packedSnow)));
    setTextIfChanged(ui.snowLoad, String(Math.round(snapshot.localPlayer.snowLoad)));
    setTextIfChanged(ui.build, snapshot.localPlayer.selectedBuild ?? "combat");
    setTextIfChanged(
      ui.cursor,
      `${snapshot.hud.cursorX.toFixed(1)} / ${snapshot.hud.cursorZ.toFixed(1)}`
    );
    setTextIfChanged(
      ui.position,
      `${snapshot.localPlayer.x.toFixed(1)} / ${snapshot.localPlayer.z.toFixed(1)}`
    );
    setTextIfChanged(
      ui.cooldown,
      snapshot.localPlayer.buildCooldownRemaining > 0
        ? `${Math.ceil(snapshot.localPlayer.buildCooldownRemaining / 1000)}s`
        : "ready"
    );
    setTextIfChanged(ui.structures, String(snapshot.structures.length));
    setTextIfChanged(ui.projectiles, String(snapshot.projectiles.length));
    setTextIfChanged(ui.opponentHp, String(Math.round(snapshot.opponentPlayer.hp)));
    setTextIfChanged(ui.preview, snapshot.hud.buildPreviewValid ? "valid" : "invalid");
    setTextIfChanged(ui.bonfire, snapshot.match.centerBonfireState);
    setTextIfChanged(ui.room, queueState.roomId ?? "local-solo");
    setTextIfChanged(
      ui.opponentState,
      `${snapshot.opponentPlayer.x.toFixed(1)} / ${snapshot.opponentPlayer.z.toFixed(1)}`
    );
  }

  function clearQueueSubscriptions() {
    for (const unsubscribe of queueUnsubscribers) {
      unsubscribe();
    }
    queueUnsubscribers.clear();
  }
}

function createSoloSceneOptions(showReturnPortal: boolean): SoloArenaSceneOptions {
  return {
    portals: {
      showExitPortal: true,
      showReturnPortal
    }
  };
}

function createInitialQueueState(): QueueStatusState {
  return {
    countdownMs: null,
    detail: "",
    message: "Queue idle. Solo keeps running until you opt in.",
    opponentGuestName: null,
    position: null,
    queuedPlayers: null,
    roomId: null,
    statusCode: "idle",
    statusStage: "idle"
  };
}

function resetQueueState(
  state: QueueStatusState,
  next: Partial<QueueStatusState> = {}
) {
  state.countdownMs = next.countdownMs ?? null;
  state.detail = next.detail ?? "";
  state.message = next.message ?? "Queue idle. Solo keeps running until you opt in.";
  state.opponentGuestName = next.opponentGuestName ?? null;
  state.position = next.position ?? null;
  state.queuedPlayers = next.queuedPlayers ?? null;
  state.roomId = next.roomId ?? null;
  state.statusCode = next.statusCode ?? "idle";
  state.statusStage = next.statusStage ?? "idle";
}

function applyQueueEvent(event: SessionProviderEvent, state: QueueStatusState) {
  if (event.type === "status") {
    state.statusCode = event.code;
    state.statusStage = event.stage ?? "none";
    state.detail = event.detail ?? "";
    state.message = event.message;
    return;
  }

  if (event.type === "queue") {
    state.position = event.position;
    state.queuedPlayers = event.queuedPlayers;
    state.roomId = event.roomId;
    state.statusCode = "queued";
    state.message = `Queued in room ${event.roomId}. Solo stays live until match start.`;
    return;
  }

  if (event.type === "match_found") {
    state.roomId = event.roomId;
    state.opponentGuestName = event.opponentGuestName;
    state.countdownMs = event.countdownFrom;
    state.statusCode = "match_found";
    state.message = `Match found against ${event.opponentGuestName}.`;
    return;
  }

  if (event.type === "countdown") {
    state.roomId = event.roomId;
    state.countdownMs = event.remainingMs;
    state.statusCode = "countdown";
    state.message = `Countdown ${Math.ceil(event.remainingMs / 1000)}s until live duel.`;
    return;
  }

  if (event.type === "requeue") {
    state.roomId = event.roomId;
    state.statusCode = "requeue";
    state.message = event.message;
  }
}

function getQueueMetaText(state: QueueStatusState, backendConfigured: boolean) {
  if (!backendConfigured && state.statusCode === "idle") {
    return `Live duel backend missing. Expected ${getProductionServerUrl()} in production or localhost locally.`;
  }

  if (state.statusCode === "queued") {
    const riders = state.queuedPlayers === null ? "--" : `${state.queuedPlayers} riders`;
    const position = state.position === null ? "--" : `P${state.position}`;
    const roomId = state.roomId ?? "--";
    return `Queue live · ${riders} · ${position} · Room ${roomId}`;
  }

  if (state.statusCode === "match_found" || state.statusCode === "countdown") {
    const countdown =
      state.countdownMs === null ? "--" : `${Math.ceil(state.countdownMs / 1000)}s`;
    return `Match found · ${state.opponentGuestName ?? "Opponent"} · ${countdown}`;
  }

  if (state.statusCode === "error") {
    return state.detail || state.message;
  }

  if (state.statusCode === "connecting" || state.statusCode === "connected") {
    return state.message;
  }

  return "Queue idle. Solo keeps running until you opt in.";
}

function getDuelMetaText(snapshot: SessionSnapshot, state: QueueStatusState) {
  const roomId = state.roomId ?? snapshot.localPlayer.slot;

  if (shellIsResolved(snapshot)) {
    return `Room ${roomId} · Duel complete`;
  }

  return `Room ${roomId} · ${snapshot.match.lifecycle} · ${snapshot.match.phase}`;
}

function shellIsResolved(snapshot: SessionSnapshot) {
  return snapshot.hud.result !== null || snapshot.match.lifecycle === "finished";
}

function resolveGuestName(portalUsername: string | null) {
  const storedName = localStorage.getItem("snowbattle.guestName")?.trim();

  if (storedName) {
    return storedName;
  }

  if (portalUsername?.trim()) {
    return portalUsername.trim();
  }

  return randomGuestName();
}

function randomGuestName() {
  const callsigns = [
    "Aurora Fox",
    "Frost Echo",
    "Glacier Kite",
    "White Ember",
    "North Halo"
  ];

  return callsigns[Math.floor(Math.random() * callsigns.length)];
}

function getMissingBackendMessage(reason: "production_missing" | "host_missing") {
  if (reason === "production_missing") {
    return `Production build is missing VITE_SERVER_URL. Set it to ${getProductionServerUrl()} before deploying GitHub Pages.`;
  }

  return "Backend endpoint is not configured for this host. Set VITE_SERVER_URL or open the app from localhost.";
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function setTextIfChanged(element: Pick<HTMLElement, "textContent">, next: string) {
  if (element.textContent !== next) {
    element.textContent = next;
  }
}
