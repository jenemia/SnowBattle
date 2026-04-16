import {
  COUNTDOWN_MS,
  type BuildType,
  type SessionProviderEvent,
  type SessionSnapshot
} from "@snowbattle/shared";

import { ThreeArena } from "../game/ThreeArena";
import { ColyseusSessionProvider } from "../providers/ColyseusSessionProvider";

const BUILD_KEY_TO_TYPE: Record<string, BuildType> = {
  "1": "wall",
  "2": "snowman_turret",
  "3": "heater_beacon"
};

export function bootMultiplayerPage(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="shell">
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
            <div class="result" id="result-banner" data-testid="multiplayer-result"></div>
            <button class="primary-button" id="requeue-button" disabled>Requeue</button>
          </div>
          <div class="panel panel-stack">
            <div class="panel">
              <h3>Duel Feed</h3>
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
            </div>
            <div class="panel">
              <h3>Input Loop</h3>
              <p class="hint">
                This page now speaks only through a session provider. Colyseus is transport,
                while the shared duel engine remains the gameplay authority.
              </p>
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
  const playerAName = root.querySelector<HTMLElement>("#player-a-name");
  const playerAState = root.querySelector<HTMLElement>("#player-a-state");
  const playerBName = root.querySelector<HTMLElement>("#player-b-name");
  const playerBState = root.querySelector<HTMLElement>("#player-b-state");

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
    !playerAName ||
    !playerAState ||
    !playerBName ||
    !playerBState
  ) {
    throw new Error("Missing multiplayer UI nodes");
  }

  const ui = {
    countdown,
    guestNameInput,
    lifecycle,
    playerAName,
    playerAState,
    playerBName,
    playerBState,
    queueCount,
    requeueButton,
    resultBanner,
    roomId,
    saveNameButton,
    statusPill,
    viewport
  };

  const storedName =
    localStorage.getItem("snowbattle.guestName") || randomGuestName();
  ui.guestNameInput.value = storedName;
  const serverUrl = resolveServerUrl();
  const isBackendConfigured = serverUrl.length > 0;

  const arena = new ThreeArena(ui.viewport);
  arena.start();

  const movement = new Set<string>();
  let pointerClientX = 0;
  let pointerClientY = 0;
  let pointerActive = false;

  const provider = isBackendConfigured
    ? new ColyseusSessionProvider(serverUrl, () => {
        return ui.guestNameInput.value.trim() || storedName;
      })
    : null;

  provider?.subscribe((snapshot) => {
    arena.applySnapshot(snapshot);
    ui.lifecycle.textContent = snapshot.match.lifecycle;
    renderPlayers(snapshot);
    renderResult(snapshot);

    if (snapshot.hud.result) {
      ui.requeueButton.disabled = false;
    }
  });

  provider?.subscribeEvent((event) => {
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
    await provider?.disconnect();
    await joinQueue();
  });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  ui.viewport.addEventListener("pointermove", handlePointerMove);
  ui.viewport.addEventListener("pointerdown", handlePointerDown);
  ui.viewport.addEventListener("pointerleave", handlePointerLeave);

  if (isBackendConfigured) {
    void joinQueue();
  } else {
    ui.statusPill.textContent = "Pages preview mode · backend not configured";
    ui.resultBanner.textContent =
      "Set VITE_SERVER_URL in GitHub Actions variables to enable live matchmaking.";
    ui.lifecycle.textContent = "preview";
    ui.countdown.textContent = "--";
    ui.requeueButton.disabled = true;
  }

  window.setInterval(() => sendInput(), 1000 / 20);

  async function joinQueue() {
    if (!provider) {
      return;
    }

    ui.resultBanner.textContent = "";
    ui.resultBanner.classList.remove("danger");

    try {
      await provider.connect();
    } catch {
      ui.statusPill.textContent = "Backend connection failed";
      ui.resultBanner.textContent =
        "The web client loaded, but the realtime game server is unreachable.";
      ui.resultBanner.classList.add("danger");
      ui.requeueButton.disabled = false;
    }
  }

  function sendInput() {
    if (!provider) {
      return;
    }

    const { moveX, moveY } = currentMovementVector();
    const worldPoint = pointerActive
      ? arena.screenPointToWorld(pointerClientX, pointerClientY)
      : null;

    provider.send({
      type: "input:update",
      payload: {
        aimX: worldPoint?.x ?? 0,
        aimY: worldPoint?.z ?? 0,
        moveX,
        moveY,
        pointerActive: worldPoint !== null
      }
    });
  }

  function currentMovementVector() {
    const x =
      Number(movement.has("d") || movement.has("ArrowRight")) -
      Number(movement.has("a") || movement.has("ArrowLeft"));
    const y =
      Number(movement.has("s") || movement.has("ArrowDown")) -
      Number(movement.has("w") || movement.has("ArrowUp"));
    return { moveX: x, moveY: y };
  }

  function renderPlayers(snapshot: SessionSnapshot) {
    ui.playerAName.textContent = snapshot.localPlayer.guestName;
    ui.playerAState.textContent = `${snapshot.localPlayer.ready ? "Ready" : "Syncing"} · x ${snapshot.localPlayer.x.toFixed(1)}`;
    ui.playerBName.textContent = snapshot.opponentPlayer.guestName;
    ui.playerBState.textContent = `${snapshot.opponentPlayer.ready ? "Ready" : "Syncing"} · x ${snapshot.opponentPlayer.x.toFixed(1)}`;
  }

  function renderResult(snapshot: SessionSnapshot) {
    const result = snapshot.hud.result;

    if (!result) {
      ui.resultBanner.textContent = "";
      ui.resultBanner.classList.remove("danger");
      return;
    }

    if (result.reason === "timeout") {
      ui.resultBanner.textContent =
        "Whiteout. No clean hit before the storm timer expired.";
      ui.resultBanner.classList.remove("danger");
      return;
    }

    const won = result.winnerSlot === snapshot.localPlayer.slot;
    ui.resultBanner.textContent = won
      ? "Direct hit. You won the duel."
      : result.winnerSlot
        ? result.reason === "forfeit"
          ? "Opponent disengaged. You take the round."
          : result.reason === "disconnect"
            ? "Opponent disconnected. The round is yours."
            : "Impact confirmed. Opponent took the round."
        : "Round resolved without a winner.";
    ui.resultBanner.classList.toggle("danger", !won && result.winnerSlot !== null);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const key = normalizeMovementKey(event.key);

    if (key) {
      event.preventDefault();
      movement.add(key);
      return;
    }

    const digitKey =
      event.code === "Numpad1" ? "1" :
      event.code === "Numpad2" ? "2" :
      event.code === "Numpad3" ? "3" :
      event.key;
    const buildType = BUILD_KEY_TO_TYPE[digitKey];

    if (buildType) {
      event.preventDefault();
      provider?.send({
        type: "build:select",
        payload: { buildType }
      });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      provider?.send({ type: "build:cancel" });
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    const key = normalizeMovementKey(event.key);

    if (key) {
      event.preventDefault();
      movement.delete(key);
    }
  }

  function handlePointerMove(event: PointerEvent) {
    pointerActive = true;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    pointerActive = true;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    sendInput();
    provider?.send({ type: "action:primary" });
  }

  function handlePointerLeave() {
    pointerActive = false;
  }
}

function handleProviderEvent(
  event: SessionProviderEvent,
  ui: {
    countdown: HTMLElement;
    lifecycle: HTMLElement;
    queueCount: HTMLElement;
    requeueButton: HTMLButtonElement;
    roomId: HTMLElement;
    statusPill: HTMLElement;
  }
) {
  if (event.type === "status") {
    ui.statusPill.textContent = event.message;
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
    return;
  }

  if (event.type === "countdown") {
    ui.countdown.textContent = `${Math.ceil(event.remainingMs / 1000)}s`;
    ui.lifecycle.textContent = "countdown";
    ui.requeueButton.disabled = true;
    return;
  }

  if (event.type === "requeue") {
    ui.requeueButton.disabled = !event.available;
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

function normalizeMovementKey(key: string) {
  const normalized = key.length === 1 ? key.toLowerCase() : key;

  return [
    "w",
    "a",
    "s",
    "d",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight"
  ].includes(normalized)
    ? normalized
    : null;
}
