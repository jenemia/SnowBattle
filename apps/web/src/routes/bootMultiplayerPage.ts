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
  presentDuelSkillStrip,
  renderDuelSkillStrip,
  renderSessionHud
} from "./solo-page";

export function bootMultiplayerPage(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="shell shell--duel">
      <section class="hero" id="multiplayer-hero">
        <div class="eyebrow">Vibe Jam Ready · Instant Browser Duel</div>
        <h1 class="title">Snow<span>Battle</span></h1>
        <p class="lede">
          Enter a live 1v1 snow duel the moment the page loads. The same shared rules engine now
          powers both local play and the authoritative Colyseus room.
        </p>
        <div class="hero-actions">
          <a class="secondary-link" href="solo">Open solo movement lab</a>
        </div>
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
        <div class="hud">
          <div class="panel" id="multiplayer-queue-panel">
            <h2>Live Queue</h2>
            <div class="status-line">
              <span class="status-pill" id="status-pill" data-testid="multiplayer-status">Booting server link…</span>
              <span id="room-id" data-testid="multiplayer-room">Room --</span>
            </div>
            <div class="name-row">
              <input id="guest-name" maxlength="20" placeholder="Guest name (saved locally)" />
              <button id="save-name">Save</button>
            </div>
            <p class="hint">
              Queue begins instantly. Move with WASD or arrows, click to throw, and use 1, 2, 3
              plus Esc for builds.
            </p>
            <div class="telemetry">
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
            <div class="solo-debug" data-testid="multiplayer-status-code">idle</div>
            <div class="solo-debug" data-testid="multiplayer-status-stage">connect</div>
            <div class="solo-debug" data-testid="multiplayer-status-detail">booting</div>
            <div class="result" id="result-banner" data-testid="multiplayer-result"></div>
            <button class="primary-button" id="requeue-button" disabled>Requeue</button>
          </div>
          <div class="panel panel-stack" id="multiplayer-debug-panel" hidden>
            <div class="panel panel--solo">
              <h3>Live Duel</h3>
              <div class="grid players">
                <article class="player-card">
                  <h4>You</h4>
                  <strong id="player-a-name" data-testid="multiplayer-local-name">Awaiting rider</strong>
                  <span id="player-a-state" data-testid="multiplayer-local-state">Not connected</span>
                </article>
                <article class="player-card">
                  <h4>Opponent</h4>
                  <strong id="player-b-name" data-testid="multiplayer-opponent-name">Awaiting rider</strong>
                  <span id="player-b-state" data-testid="multiplayer-opponent-state">Not connected</span>
                </article>
              </div>
              <div class="status-line">
                <span class="status-pill" id="multiplayer-session-status" data-testid="multiplayer-session-status">Combat</span>
                <span id="multiplayer-session-mode" data-testid="multiplayer-session-mode">Mode ready</span>
              </div>
              <p class="hint">
                Matchmaking and transport stay duel-specific. Once the round begins, the gameplay
                surface is the same as solo.
              </p>
              <div class="telemetry solo-stats">
                <div>
                  <span>Phase</span>
                  <strong id="multiplayer-phase" data-testid="multiplayer-phase">standard</strong>
                </div>
                <div>
                  <span>Time</span>
                  <strong id="multiplayer-time" data-testid="multiplayer-time">02:00</strong>
                </div>
                <div>
                  <span>HP</span>
                  <strong id="multiplayer-hp" data-testid="multiplayer-hp">100</strong>
                </div>
                <div>
                  <span>Snow Load</span>
                  <strong id="multiplayer-snow-load" data-testid="multiplayer-snow-load">0</strong>
                </div>
                <div>
                  <span>Packed Snow</span>
                  <strong id="multiplayer-packed-snow" data-testid="multiplayer-packed-snow">100</strong>
                </div>
                <div>
                  <span>Build</span>
                  <strong id="multiplayer-build" data-testid="multiplayer-build">combat</strong>
                </div>
              </div>
              <div class="solo-debug" id="multiplayer-cursor" data-testid="multiplayer-cursor">0.0 / 0.0</div>
              <div class="solo-debug" id="multiplayer-position" data-testid="multiplayer-position">0.0 / 0.0</div>
              <div class="telemetry solo-stats">
                <div>
                  <span>Cooldown</span>
                  <strong id="multiplayer-cooldown" data-testid="multiplayer-cooldown">0.00s</strong>
                </div>
                <div>
                  <span>Structures</span>
                  <strong id="multiplayer-structures" data-testid="multiplayer-structures">0</strong>
                </div>
                <div>
                  <span>Projectiles</span>
                  <strong id="multiplayer-projectiles" data-testid="multiplayer-projectiles">0</strong>
                </div>
                <div>
                  <span>Opponent HP</span>
                  <strong id="multiplayer-opponent-hp" data-testid="multiplayer-opponent-hp">100</strong>
                </div>
                <div>
                  <span>Preview</span>
                  <strong id="multiplayer-preview" data-testid="multiplayer-preview">blocked</strong>
                </div>
                <div>
                  <span>Bonfire</span>
                  <strong id="multiplayer-bonfire" data-testid="multiplayer-bonfire">idle</strong>
                </div>
              </div>
              <div class="result" id="multiplayer-session-result" data-testid="multiplayer-session-result"></div>
              <div class="solo-readout" id="multiplayer-readout" data-testid="multiplayer-readout">
                Searching for a duel...
              </div>
            </div>
          </div>
        </div>
        <div
          class="duel-skill-strip"
          id="multiplayer-prod-skill-strip"
          data-testid="multiplayer-prod-skill-strip"
          hidden
        >
          <div class="duel-skill-chip">
            <span>Cooldown</span>
            <strong id="multiplayer-prod-cooldown" data-testid="multiplayer-prod-cooldown">0.00s</strong>
          </div>
          <div class="duel-skill-chip">
            <span>Wall</span>
            <strong id="multiplayer-prod-wall" data-testid="multiplayer-prod-wall">Wall 2</strong>
          </div>
          <div class="duel-skill-chip">
            <span>Turret</span>
            <strong id="multiplayer-prod-turret" data-testid="multiplayer-prod-turret">Turret 1</strong>
          </div>
          <div class="duel-skill-chip">
            <span>Heater</span>
            <strong id="multiplayer-prod-heater" data-testid="multiplayer-prod-heater">Heater 1</strong>
          </div>
        </div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#viewport");
  const hero = root.querySelector<HTMLElement>("#multiplayer-hero");
  const queuePanel = root.querySelector<HTMLElement>("#multiplayer-queue-panel");
  const debugPanel = root.querySelector<HTMLElement>("#multiplayer-debug-panel");
  const prodSkillStrip = root.querySelector<HTMLElement>("#multiplayer-prod-skill-strip");
  const guestNameInput = root.querySelector<HTMLInputElement>("#guest-name");
  const saveNameButton = root.querySelector<HTMLButtonElement>("#save-name");
  const requeueButton = root.querySelector<HTMLButtonElement>("#requeue-button");
  const statusPill = root.querySelector<HTMLElement>("#status-pill");
  const roomId = root.querySelector<HTMLElement>("#room-id");
  const queueCount = root.querySelector<HTMLElement>("#queue-count");
  const countdown = root.querySelector<HTMLElement>("#countdown");
  const lifecycle = root.querySelector<HTMLElement>("#lifecycle");
  const resultBanner = root.querySelector<HTMLElement>("#result-banner");
  const statusCode = root.querySelector<HTMLElement>("[data-testid='multiplayer-status-code']");
  const statusStage = root.querySelector<HTMLElement>("[data-testid='multiplayer-status-stage']");
  const statusDetail = root.querySelector<HTMLElement>("[data-testid='multiplayer-status-detail']");
  const playerAName = root.querySelector<HTMLElement>("#player-a-name");
  const playerAState = root.querySelector<HTMLElement>("#player-a-state");
  const playerBName = root.querySelector<HTMLElement>("#player-b-name");
  const playerBState = root.querySelector<HTMLElement>("#player-b-state");
  const sessionStatus = root.querySelector<HTMLElement>("#multiplayer-session-status");
  const sessionMode = root.querySelector<HTMLElement>("#multiplayer-session-mode");
  const timerBadge = root.querySelector<HTMLElement>("#multiplayer-timer-badge");
  const phase = root.querySelector<HTMLElement>("#multiplayer-phase");
  const time = root.querySelector<HTMLElement>("#multiplayer-time");
  const hp = root.querySelector<HTMLElement>("#multiplayer-hp");
  const snowLoad = root.querySelector<HTMLElement>("#multiplayer-snow-load");
  const packedSnow = root.querySelector<HTMLElement>("#multiplayer-packed-snow");
  const build = root.querySelector<HTMLElement>("#multiplayer-build");
  const cursor = root.querySelector<HTMLElement>("#multiplayer-cursor");
  const position = root.querySelector<HTMLElement>("#multiplayer-position");
  const cooldown = root.querySelector<HTMLElement>("#multiplayer-cooldown");
  const structures = root.querySelector<HTMLElement>("#multiplayer-structures");
  const projectiles = root.querySelector<HTMLElement>("#multiplayer-projectiles");
  const opponentHp = root.querySelector<HTMLElement>("#multiplayer-opponent-hp");
  const preview = root.querySelector<HTMLElement>("#multiplayer-preview");
  const bonfire = root.querySelector<HTMLElement>("#multiplayer-bonfire");
  const sessionResult = root.querySelector<HTMLElement>("#multiplayer-session-result");
  const readout = root.querySelector<HTMLElement>("#multiplayer-readout");
  const prodCooldown = root.querySelector<HTMLElement>("#multiplayer-prod-cooldown");
  const prodWall = root.querySelector<HTMLElement>("#multiplayer-prod-wall");
  const prodTurret = root.querySelector<HTMLElement>("#multiplayer-prod-turret");
  const prodHeater = root.querySelector<HTMLElement>("#multiplayer-prod-heater");

  if (
    !viewport ||
    !hero ||
    !queuePanel ||
    !debugPanel ||
    !prodSkillStrip ||
    !guestNameInput ||
    !saveNameButton ||
    !requeueButton ||
    !statusPill ||
    !roomId ||
    !queueCount ||
    !countdown ||
    !lifecycle ||
    !resultBanner ||
    !statusCode ||
    !statusStage ||
    !statusDetail ||
    !playerAName ||
    !playerAState ||
    !playerBName ||
    !playerBState ||
    !sessionStatus ||
    !sessionMode ||
    !timerBadge ||
    !phase ||
    !time ||
    !hp ||
    !snowLoad ||
    !packedSnow ||
    !build ||
    !cursor ||
    !position ||
    !cooldown ||
    !structures ||
    !projectiles ||
    !opponentHp ||
    !preview ||
    !bonfire ||
    !sessionResult ||
    !readout ||
    !prodCooldown ||
    !prodWall ||
    !prodTurret ||
    !prodHeater
  ) {
    throw new Error("Missing multiplayer UI nodes");
  }

  debugPanel.style.display = "none";

  const ui = {
    bonfire,
    build,
    countdown,
    cooldown,
    cursor,
    debugPanel,
    guestNameInput,
    hero,
    hp,
    lifecycle,
    mode: sessionMode,
    opponentHp,
    packedSnow,
    phase,
    playerAName,
    playerAState,
    playerBName,
    playerBState,
    position,
    preview,
    prodCooldown,
    prodHeater,
    prodSkillStrip,
    prodTurret,
    prodWall,
    projectiles,
    queueCount,
    queuePanel,
    readout,
    requeueButton,
    result: sessionResult,
    resultBanner,
    roomId,
    saveNameButton,
    snowLoad,
    status: sessionStatus,
    statusCode,
    statusDetail,
    statusPill,
    statusStage,
    structures,
    timerBadge,
    time,
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
  let lastPlayerState: RenderedPlayers | null = null;
  let lastSkillStrip: ReturnType<typeof presentDuelSkillStrip> | null = null;
  let latestSnapshot: SessionSnapshot | null = null;
  let latestSurfaceState: ReturnType<typeof getMultiplayerUiState> | null = null;

  syncCombatSurfaceState();

  const mountSession = isBackendConfigured
    ? mountPredictedDuelSession
    : mountGameSession;

  mountSession({
    autoConnect: false,
    onSnapshot: (snapshot) => {
      latestSnapshot = snapshot;
      const hud = presentDuelHud(snapshot);
      const skillStrip = presentDuelSkillStrip(snapshot);
      renderSessionHud(
        {
          actionButton: ui.requeueButton,
          bonfire: ui.bonfire,
          build: ui.build,
          cooldown: ui.cooldown,
          cursor: ui.cursor,
          hp: ui.hp,
          mode: ui.mode,
          opponentHp: ui.opponentHp,
          packedSnow: ui.packedSnow,
          phase: ui.phase,
          position: ui.position,
          preview: ui.preview,
          projectiles: ui.projectiles,
          readout: ui.readout,
          result: ui.result,
          snowLoad: ui.snowLoad,
          status: ui.status,
          structures: ui.structures,
          timerBadge: ui.timerBadge,
          time: ui.time
        },
        hud,
        lastHud
      );
      lastHud = hud;
      renderDuelSkillStrip(
        {
          cooldown: ui.prodCooldown,
          heaterBeacon: ui.prodHeater,
          snowmanTurret: ui.prodTurret,
          wall: ui.prodWall
        },
        skillStrip,
        lastSkillStrip
      );
      lastSkillStrip = skillStrip;
      setTextIfChanged(ui.lifecycle, ui.lifecycle.textContent, snapshot.match.lifecycle);
      lastPlayerState = renderPlayers(
        snapshot,
        ui.playerAName,
        ui.playerAState,
        ui.playerBName,
        ui.playerBState,
        lastPlayerState
      );
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
    ui.statusPill.textContent = "Saved. Requeue to update your call sign.";
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
      hostname: window.location.hostname,
      lifecycle: latestSnapshot?.match.lifecycle ?? null
    });

    if (
      latestSurfaceState &&
      latestSurfaceState.showHero === surfaceState.showHero &&
      latestSurfaceState.showQueuePanel === surfaceState.showQueuePanel &&
      latestSurfaceState.showDebugPanel === surfaceState.showDebugPanel &&
      latestSurfaceState.showProdSkillStrip === surfaceState.showProdSkillStrip
    ) {
      return;
    }

    ui.hero.hidden = !surfaceState.showHero;
    ui.queuePanel.hidden = !surfaceState.showQueuePanel;
    ui.debugPanel.hidden = !surfaceState.showDebugPanel;
    ui.prodSkillStrip.hidden = !surfaceState.showProdSkillStrip;
    ui.timerBadge.hidden = !surfaceState.showDebugPanel;
    latestSurfaceState = surfaceState;
  }
}

interface RenderedPlayers {
  localName: string;
  localState: string;
  opponentName: string;
  opponentState: string;
}

function renderPlayers(
  snapshot: SessionSnapshot,
  localName: HTMLElement,
  localState: HTMLElement,
  opponentName: HTMLElement,
  opponentState: HTMLElement,
  previous: RenderedPlayers | null = null
) {
  const nextState = {
    localName: snapshot.localPlayer.guestName,
    localState: `${snapshot.localPlayer.ready ? "Ready" : "Syncing"} · x ${snapshot.localPlayer.x.toFixed(1)}`,
    opponentName: snapshot.opponentPlayer.guestName,
    opponentState: `${snapshot.opponentPlayer.ready ? "Ready" : "Syncing"} · x ${snapshot.opponentPlayer.x.toFixed(1)}`
  };

  setTextIfChanged(localName, previous?.localName, nextState.localName);
  setTextIfChanged(localState, previous?.localState, nextState.localState);
  setTextIfChanged(opponentName, previous?.opponentName, nextState.opponentName);
  setTextIfChanged(opponentState, previous?.opponentState, nextState.opponentState);

  return nextState;
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
