import {
  COUNTDOWN_MS,
  type GameSessionProvider,
  type SessionProviderEvent,
  type SessionSnapshot
} from "@snowbattle/shared";

import { ColyseusSessionProvider } from "../providers/ColyseusSessionProvider";
import { getMultiplayerUiState } from "./multiplayerUiState";
import { getProductionServerUrl, resolveServerUrl } from "../serverUrl";
import {
  mountGameSession,
  mountPredictedDuelSession,
  presentDuelHud,
  renderControlsGuideCard,
  renderHeroActions,
  renderSessionHud
} from "./solo-page";

export function bootMultiplayerPage(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="shell shell--duel">
      <section class="hero hero--compact" id="multiplayer-hero">
        <div class="eyebrow">Vibe Jam Ready · Instant Browser Duel</div>
        <h1 class="title">Snow<span>Battle</span></h1>
        <p class="lede">
          Jump into a live 1v1 snow duel with the same shared combat rules used in solo mode.
          The page stays minimal so the playfield stays front and center.
        </p>
        ${renderHeroActions([
          {
            href: "solo",
            label: "Open solo movement lab",
            testId: "multiplayer-solo-link"
          },
          {
            href: "matchmaking-loadtest",
            label: "Open load test",
            testId: "multiplayer-loadtest-link"
          }
        ])}
      </section>
      <section class="arena">
        <div class="viewport" id="viewport" data-testid="multiplayer-viewport"></div>
        <div
          class="match-timer-badge"
          id="multiplayer-timer-badge"
          data-testid="multiplayer-timer-badge"
          hidden
        >
          02:00
        </div>
        <div class="overlay-stack overlay-stack--top-left">
          <section
            class="overlay-card status-card status-card--interactive"
            id="multiplayer-status-card"
            data-testid="multiplayer-status-card"
          >
            <div class="status-line status-line--compact">
              <span
                class="status-pill"
                id="status-pill"
                data-testid="multiplayer-status"
              >
                Booting server link…
              </span>
              <span id="room-id" data-testid="multiplayer-room">Room --</span>
            </div>
            <div class="name-row name-row--compact">
              <input id="guest-name" maxlength="20" placeholder="Guest name" />
              <button id="save-name" type="button">Save</button>
            </div>
            <div class="status-grid">
              <div>
                <span>Queue</span>
                <strong id="queue-count" data-testid="multiplayer-queue">0 riders</strong>
              </div>
              <div>
                <span>Countdown</span>
                <strong id="countdown" data-testid="multiplayer-countdown">--</strong>
              </div>
              <div>
                <span>Round</span>
                <strong id="lifecycle" data-testid="multiplayer-lifecycle">waiting</strong>
              </div>
            </div>
            <div
              class="status-copy"
              id="multiplayer-readout"
              data-testid="multiplayer-readout"
            >
              Searching for a duel...
            </div>
            <div class="result" id="result-banner" data-testid="multiplayer-result"></div>
            <button class="primary-button" id="requeue-button" type="button" disabled>
              Requeue
            </button>
            <div class="status-meta" data-testid="multiplayer-status-code">idle</div>
            <div class="status-meta" data-testid="multiplayer-status-stage">connect</div>
            <div class="status-meta" data-testid="multiplayer-status-detail">booting</div>
          </section>
        </div>
        <div
          class="overlay-stack overlay-stack--bottom-left"
          id="multiplayer-controls-guide"
          hidden
        >
          ${renderControlsGuideCard("multiplayer")}
        </div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#viewport");
  const hero = root.querySelector<HTMLElement>("#multiplayer-hero");
  const statusCard = root.querySelector<HTMLElement>("#multiplayer-status-card");
  const controlsGuide = root.querySelector<HTMLElement>("#multiplayer-controls-guide");
  const guestNameInput = root.querySelector<HTMLInputElement>("#guest-name");
  const saveNameButton = root.querySelector<HTMLButtonElement>("#save-name");
  const requeueButton = root.querySelector<HTMLButtonElement>("#requeue-button");
  const statusPill = root.querySelector<HTMLElement>("#status-pill");
  const roomId = root.querySelector<HTMLElement>("#room-id");
  const queueCount = root.querySelector<HTMLElement>("#queue-count");
  const countdown = root.querySelector<HTMLElement>("#countdown");
  const lifecycle = root.querySelector<HTMLElement>("#lifecycle");
  const resultBanner = root.querySelector<HTMLElement>("#result-banner");
  const readout = root.querySelector<HTMLElement>("#multiplayer-readout");
  const statusCode = root.querySelector<HTMLElement>("[data-testid='multiplayer-status-code']");
  const statusStage = root.querySelector<HTMLElement>("[data-testid='multiplayer-status-stage']");
  const statusDetail = root.querySelector<HTMLElement>("[data-testid='multiplayer-status-detail']");
  const timerBadge = root.querySelector<HTMLElement>("#multiplayer-timer-badge");

  if (
    !viewport ||
    !hero ||
    !statusCard ||
    !controlsGuide ||
    !guestNameInput ||
    !saveNameButton ||
    !requeueButton ||
    !statusPill ||
    !roomId ||
    !queueCount ||
    !countdown ||
    !lifecycle ||
    !resultBanner ||
    !readout ||
    !statusCode ||
    !statusStage ||
    !statusDetail ||
    !timerBadge
  ) {
    throw new Error("Missing multiplayer UI nodes");
  }

  const ui = {
    controlsGuide,
    countdown,
    guestNameInput,
    hero,
    lifecycle,
    queueCount,
    readout,
    requeueButton,
    resultBanner,
    roomId,
    saveNameButton,
    statusCard,
    statusCode,
    statusDetail,
    statusPill,
    statusStage,
    timerBadge,
    viewport
  };

  const storedName =
    localStorage.getItem("snowbattle.guestName") || randomGuestName();
  ui.guestNameInput.value = storedName;
  const backendConfig = resolveServerUrl({
    explicitUrl: import.meta.env.VITE_SERVER_URL,
    hostname: window.location.hostname,
    isProduction: import.meta.env.PROD
  });
  const isBackendConfigured = backendConfig.isConfigured;

  const provider = isBackendConfigured
    ? new ColyseusSessionProvider(backendConfig.serverUrl, () => {
        return ui.guestNameInput.value.trim() || storedName;
      })
    : createPreviewProvider();
  let lastHud: ReturnType<typeof presentDuelHud> | null = null;
  let latestSnapshot: SessionSnapshot | null = null;
  let latestSurfaceState: ReturnType<typeof getMultiplayerUiState> | null = null;

  syncCombatSurfaceState();

  const mountSession = isBackendConfigured
    ? mountPredictedDuelSession
    : mountGameSession;

  mountSession({
    autoConnect: false,
    onSceneError: (error) => {
      ui.statusPill.textContent = "3D unavailable";
      ui.statusCode.textContent = "error";
      ui.statusStage.textContent = "render";
      ui.statusDetail.textContent = formatError(error);
      ui.readout.textContent =
        "This browser could not start the WebGL duel scene. Try solo mode on another device or browser.";
      ui.resultBanner.textContent =
        "WebGL initialization failed before the arena could render.";
      ui.requeueButton.disabled = true;
    },
    onSnapshot: (snapshot) => {
      latestSnapshot = snapshot;
      const hud = presentDuelHud(snapshot);

      renderSessionHud(
        {
          actionButton: ui.requeueButton,
          readout: ui.readout,
          result: ui.resultBanner,
          timerBadge: ui.timerBadge
        },
        hud,
        lastHud
      );
      lastHud = hud;
      setTextIfChanged(ui.lifecycle, ui.lifecycle.textContent, snapshot.match.lifecycle);
      syncCombatSurfaceState();
    },
    provider,
    viewport: ui.viewport
  });

  provider.subscribeEvent((event) => {
    handleProviderEvent(event, ui);
    syncCombatSurfaceState();
  });

  ui.saveNameButton.addEventListener("click", () => {
    localStorage.setItem(
      "snowbattle.guestName",
      ui.guestNameInput.value.trim() || storedName
    );
    ui.statusPill.textContent = "Saved";
    ui.readout.textContent = "Requeue to update your call sign.";
  });

  ui.requeueButton.addEventListener("click", async () => {
    ui.requeueButton.disabled = true;
    ui.resultBanner.textContent = "";
    ui.resultBanner.classList.remove("danger");
    await provider.disconnect();
    await joinQueue();
  });

  if (isBackendConfigured) {
    void joinQueue();
  } else {
    const missingReason =
      backendConfig.reason === "production_missing"
        ? "production_missing"
        : "host_missing";
    ui.statusPill.textContent = backendConfig.statusMessage;
    ui.statusCode.textContent = "idle";
    ui.statusStage.textContent = "config";
    ui.statusDetail.textContent = backendConfig.statusDetail;
    ui.resultBanner.textContent = getMissingBackendMessage(missingReason);
    ui.lifecycle.textContent = "preview";
    ui.countdown.textContent = "--";
    ui.requeueButton.disabled = true;
    ui.readout.textContent = getMissingBackendReadout(missingReason);
    syncCombatSurfaceState();
  }

  async function joinQueue() {
    if (!isBackendConfigured) {
      return;
    }

    ui.resultBanner.textContent = "";
    ui.resultBanner.classList.remove("danger");

    try {
      await provider.connect();
    } catch {
      ui.requeueButton.disabled = false;
    }
  }

  function syncCombatSurfaceState() {
    const surfaceState = getMultiplayerUiState({
      hasLiveSnapshot: latestSnapshot !== null,
      lifecycle: latestSnapshot?.match.lifecycle ?? null
    });

    if (
      latestSurfaceState &&
      latestSurfaceState.showControlsGuide === surfaceState.showControlsGuide &&
      latestSurfaceState.showHero === surfaceState.showHero &&
      latestSurfaceState.showStatusCard === surfaceState.showStatusCard &&
      latestSurfaceState.showTimerBadge === surfaceState.showTimerBadge
    ) {
      return;
    }

    ui.hero.hidden = !surfaceState.showHero;
    ui.statusCard.hidden = !surfaceState.showStatusCard;
    ui.controlsGuide.hidden = !surfaceState.showControlsGuide;
    ui.timerBadge.hidden = !surfaceState.showTimerBadge;
    latestSurfaceState = surfaceState;
  }
}

function handleProviderEvent(
  event: SessionProviderEvent,
  ui: {
    countdown: HTMLElement;
    lifecycle: HTMLElement;
    queueCount: HTMLElement;
    readout: HTMLElement;
    requeueButton: HTMLButtonElement;
    resultBanner: HTMLElement;
    roomId: HTMLElement;
    statusCode: HTMLElement;
    statusDetail: HTMLElement;
    statusPill: HTMLElement;
    statusStage: HTMLElement;
  }
) {
  if (event.type === "status") {
    ui.statusPill.textContent = event.message;
    ui.statusCode.textContent = event.code;
    ui.statusStage.textContent = event.stage ?? "none";
    ui.statusDetail.textContent = event.detail ?? event.serverUrl ?? "none";

    if (event.code === "error") {
      ui.resultBanner.textContent = event.detail
        ? `Backend connection failed: ${event.detail}`
        : "Backend connection failed.";
      ui.resultBanner.classList.add("danger");
      return;
    }

    if (event.code === "connected" || event.code === "queued") {
      ui.readout.textContent = "Connected. Waiting for the shared duel to begin.";
    }

    if (event.code !== "disconnected") {
      ui.resultBanner.classList.remove("danger");
    }
    return;
  }

  if (event.type === "queue") {
    ui.queueCount.textContent = `${event.queuedPlayers} rider${
      event.queuedPlayers === 1 ? "" : "s"
    }`;
    ui.roomId.textContent = `Room ${event.roomId}`;
    ui.lifecycle.textContent = "waiting";
    ui.countdown.textContent = `${Math.ceil(COUNTDOWN_MS / 1000)}s`;
    return;
  }

  if (event.type === "match_found") {
    ui.roomId.textContent = `Room ${event.roomId}`;
    ui.countdown.textContent = `${Math.ceil(event.countdownFrom / 1000)}s`;
    ui.readout.textContent = `Match found against ${event.opponentGuestName}.`;
    return;
  }

  if (event.type === "countdown") {
    ui.countdown.textContent = `${Math.ceil(event.remainingMs / 1000)}s`;
    ui.lifecycle.textContent = "countdown";
    ui.readout.textContent = `Countdown ${Math.ceil(event.remainingMs / 1000)}s.`;
    ui.requeueButton.disabled = true;
    return;
  }

  if (event.type === "requeue") {
    ui.requeueButton.disabled = !event.available;
    ui.readout.textContent = event.message;
  }
}

function setTextIfChanged(
  element: Pick<HTMLElement, "textContent">,
  previous: string | null | undefined,
  next: string
) {
  if (previous !== next) {
    element.textContent = next;
  }
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

function createPreviewProvider(): GameSessionProvider {
  return {
    connect() {},
    disconnect() {},
    getLatestStateEnvelope() {
      return null;
    },
    getLatestSnapshot() {
      return null;
    },
    getSessionMeta() {
      return null;
    },
    send() {},
    subscribe() {
      return () => {};
    },
    subscribeStateEnvelope() {
      return () => {};
    },
    subscribeEvent() {
      return () => {};
    }
  };
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getMissingBackendMessage(reason: "production_missing" | "host_missing") {
  if (reason === "production_missing") {
    return `Production build is missing VITE_SERVER_URL. Set it to ${getProductionServerUrl()} before deploying GitHub Pages.`;
  }

  return "Backend endpoint is not configured for this host. Set VITE_SERVER_URL or open the app from localhost.";
}

function getMissingBackendReadout(reason: "production_missing" | "host_missing") {
  if (reason === "production_missing") {
    return `Waiting for a production backend. Expected ${getProductionServerUrl()}.`;
  }

  return "Preview mode. Configure VITE_SERVER_URL or use localhost for live duels.";
}
