import {
  COUNTDOWN_MS,
  type GameSessionProvider,
  type SessionProviderEvent,
  type SessionSnapshot
} from "@snowbattle/shared";

import { ColyseusSessionProvider } from "../providers/ColyseusSessionProvider";
import { mountGameSession, presentDuelHud, renderSessionHud } from "./solo-page";

export function bootMultiplayerPage(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="shell shell--duel">
      <section class="hero">
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
        <div class="hud">
          <div class="panel">
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
          <div class="panel panel-stack">
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
                  <strong id="multiplayer-time" data-testid="multiplayer-time">180.0s</strong>
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
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#viewport");
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

  if (
    !viewport ||
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
    !readout
  ) {
    throw new Error("Missing multiplayer UI nodes");
  }

  const ui = {
    bonfire,
    build,
    countdown,
    cooldown,
    cursor,
    guestNameInput,
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
    projectiles,
    queueCount,
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
    time,
    viewport
  };

  const storedName =
    localStorage.getItem("snowbattle.guestName") || randomGuestName();
  ui.guestNameInput.value = storedName;
  const serverUrl = resolveServerUrl();
  const isBackendConfigured = serverUrl.length > 0;

  const provider = isBackendConfigured
    ? new ColyseusSessionProvider(serverUrl, () => {
        return ui.guestNameInput.value.trim() || storedName;
      })
    : createPreviewProvider();

  mountGameSession({
    autoConnect: false,
    onSnapshot: (snapshot) => {
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
          time: ui.time
        },
        presentDuelHud(snapshot)
      );
      ui.lifecycle.textContent = snapshot.match.lifecycle;
      renderPlayers(snapshot, ui.playerAName, ui.playerAState, ui.playerBName, ui.playerBState);
    },
    provider,
    viewport: ui.viewport
  });

  provider.subscribeEvent((event) => {
    handleProviderEvent(event, ui);
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
    ui.statusPill.textContent = "Pages preview mode · backend not configured";
    ui.resultBanner.textContent =
      "Set VITE_SERVER_URL in GitHub Actions variables to enable live matchmaking.";
    ui.lifecycle.textContent = "preview";
    ui.countdown.textContent = "--";
    ui.requeueButton.disabled = true;
    ui.readout.textContent = "Preview mode. Configure a backend to play a live duel.";
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
}

function renderPlayers(
  snapshot: SessionSnapshot,
  localName: HTMLElement,
  localState: HTMLElement,
  opponentName: HTMLElement,
  opponentState: HTMLElement
) {
  localName.textContent = snapshot.localPlayer.guestName;
  localState.textContent = `${snapshot.localPlayer.ready ? "Ready" : "Syncing"} · x ${snapshot.localPlayer.x.toFixed(1)}`;
  opponentName.textContent = snapshot.opponentPlayer.guestName;
  opponentState.textContent = `${snapshot.opponentPlayer.ready ? "Ready" : "Syncing"} · x ${snapshot.opponentPlayer.x.toFixed(1)}`;
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

function resolveServerUrl() {
  const explicitUrl = import.meta.env.VITE_SERVER_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  return isLocalHost ? "ws://localhost:2567" : "";
}

function createPreviewProvider(): GameSessionProvider {
  return {
    connect() {},
    disconnect() {},
    getLatestSnapshot() {
      return null;
    },
    send() {},
    subscribe() {
      return () => {};
    },
    subscribeEvent() {
      return () => {};
    }
  };
}
