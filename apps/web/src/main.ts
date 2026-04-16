import "./styles.css";

import {
  COUNTDOWN_MS,
  type MatchResultMessage,
  type PlayerSnapshot,
  type StateSnapshotMessage
} from "@snowbattle/shared";

import { ThreeArena } from "./game/ThreeArena";
import { SnowBattleClient } from "./network/SnowBattleClient";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app mount");
}

root.innerHTML = `
  <div class="shell">
    <section class="hero">
      <div class="eyebrow">Vibe Jam Ready · Instant Browser Duel</div>
      <h1 class="title">Snow<span>Battle</span></h1>
      <p class="lede">
        Enter a live 1v1 snow duel the moment the page loads. No account wall, no lobby maze,
        just a frost-lit arena, authoritative sync, and one clean shot to land first.
      </p>
    </section>
    <section class="arena">
      <div class="viewport" id="viewport"></div>
      <div class="hud">
        <div class="panel">
          <h2>Live Queue</h2>
          <div class="status-line">
            <span class="status-pill" id="status-pill">Booting server link…</span>
            <span id="room-id">Room --</span>
          </div>
          <div class="name-row">
            <input id="guest-name" maxlength="20" placeholder="Guest name (saved locally)" />
            <button id="save-name">Save</button>
          </div>
          <p class="hint">
            Queue begins instantly. Move with WASD or arrows, aim with your cursor, click to throw.
          </p>
          <div class="telemetry">
            <div>
              <span>Queue</span>
              <strong id="queue-count">0 riders</strong>
            </div>
            <div>
              <span>Countdown</span>
              <strong id="countdown">--</strong>
            </div>
            <div>
              <span>Round</span>
              <strong id="lifecycle">waiting</strong>
            </div>
          </div>
          <div class="result" id="result-banner"></div>
          <button class="primary-button" id="requeue-button" disabled>Requeue</button>
        </div>
        <div class="panel panel-stack">
          <div class="panel">
            <h3>Duel Feed</h3>
            <div class="grid players">
              <article class="player-card">
                <h4>Slot A</h4>
                <strong id="player-a-name">Awaiting rider</strong>
                <span id="player-a-state">Not connected</span>
              </article>
              <article class="player-card">
                <h4>Slot B</h4>
                <strong id="player-b-name">Awaiting rider</strong>
                <span id="player-b-state">Not connected</span>
              </article>
            </div>
          </div>
          <div class="panel">
            <h3>Input Loop</h3>
            <p class="hint">
              This client renders a lightweight Three.js arena while the server remains
              authoritative for movement, collisions, countdown, and match results.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
`;

const viewport = document.querySelector<HTMLElement>("#viewport");
const guestNameInput = document.querySelector<HTMLInputElement>("#guest-name");
const saveNameButton = document.querySelector<HTMLButtonElement>("#save-name");
const requeueButton = document.querySelector<HTMLButtonElement>("#requeue-button");
const statusPill = document.querySelector<HTMLElement>("#status-pill");
const roomId = document.querySelector<HTMLElement>("#room-id");
const queueCount = document.querySelector<HTMLElement>("#queue-count");
const countdown = document.querySelector<HTMLElement>("#countdown");
const lifecycle = document.querySelector<HTMLElement>("#lifecycle");
const resultBanner = document.querySelector<HTMLElement>("#result-banner");
const playerAName = document.querySelector<HTMLElement>("#player-a-name");
const playerAState = document.querySelector<HTMLElement>("#player-a-state");
const playerBName = document.querySelector<HTMLElement>("#player-b-name");
const playerBState = document.querySelector<HTMLElement>("#player-b-state");

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
  throw new Error("Missing UI nodes");
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

const storedName = localStorage.getItem("snowbattle.guestName") || randomGuestName();
ui.guestNameInput.value = storedName;

const arena = new ThreeArena(ui.viewport);
arena.start();

let latestState: StateSnapshotMessage | null = null;
let localSessionId: string | null = null;
let inputSequence = 0;
const pointer = { x: 0, y: 0, active: false };
const movement = new Set<string>();
let fireQueued = false;

const client = new SnowBattleClient(
  import.meta.env.VITE_SERVER_URL || "ws://localhost:2567",
  {
    onCountdown(message) {
      ui.countdown.textContent = `${Math.ceil(message.remainingMs / 1000)}s`;
      ui.lifecycle.textContent = "countdown";
      ui.requeueButton.disabled = true;
    },
    onMatchFound(message) {
      ui.statusPill.textContent = `Match found · Slot ${message.slot}`;
      ui.roomId.textContent = `Room ${message.roomId}`;
    },
    onQueueStatus(message) {
      ui.queueCount.textContent = `${message.queuedPlayers} rider${
        message.queuedPlayers === 1 ? "" : "s"
      }`;
      ui.statusPill.textContent = `Queued · Position ${message.position}`;
      ui.roomId.textContent = `Room ${message.roomId}`;
      ui.lifecycle.textContent = "waiting";
      ui.countdown.textContent = `${Math.ceil(COUNTDOWN_MS / 1000)}s`;
    },
    onRequeue(message) {
      ui.requeueButton.disabled = !message.available;
      ui.statusPill.textContent = message.message;
    },
    onResult(message) {
      renderResult(message);
      ui.lifecycle.textContent = "finished";
      ui.requeueButton.disabled = false;
    },
    onState(message) {
      latestState = message;
      arena.applyState(message);
      ui.lifecycle.textContent = message.lifecycle;
      ui.roomId.textContent = `Room ${message.roomId}`;
      renderPlayers(message.players);
    },
    onStatusChange(value) {
      ui.statusPill.textContent = value;
    }
  }
);

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
  await client.leave("requeue");
  await joinQueue();
});

window.addEventListener("keydown", (event) => {
  if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    movement.add(event.key);
  }
});

window.addEventListener("keyup", (event) => {
  movement.delete(event.key);
});

ui.viewport.addEventListener("pointermove", (event) => {
  const bounds = ui.viewport.getBoundingClientRect();
  pointer.x = event.clientX - bounds.left - bounds.width / 2;
  pointer.y = event.clientY - bounds.top - bounds.height / 2;
  pointer.active = true;
});

ui.viewport.addEventListener("pointerdown", () => {
  fireQueued = true;
});

void joinQueue();
window.setInterval(() => sendInput(), 1000 / 20);

async function joinQueue() {
  ui.resultBanner.textContent = "";
  ui.resultBanner.classList.remove("danger");
  await client.queue(ui.guestNameInput.value.trim() || storedName);
  localSessionId = client.sessionId;
  arena.setLocalSessionId(localSessionId);
}

function sendInput() {
  if (!client.sessionId) {
    return;
  }

  const { moveX, moveY } = currentMovementVector();
  const pointerAngle = pointer.active ? Math.atan2(pointer.y, pointer.x) : 0;

  client.sendInput({
    sequence: inputSequence,
    moveX,
    moveY,
    pointerAngle,
    fire: fireQueued
  });

  inputSequence += 1;
  fireQueued = false;
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

function renderPlayers(players: PlayerSnapshot[]) {
  const slotA = players.find((player) => player.slot === "A");
  const slotB = players.find((player) => player.slot === "B");

  ui.playerAName.textContent = slotA?.guestName ?? "Awaiting rider";
  ui.playerAState.textContent = slotA
    ? `${slotA.ready ? "Ready" : "Syncing"} · x ${slotA.x.toFixed(1)}`
    : "Not connected";
  ui.playerBName.textContent = slotB?.guestName ?? "Awaiting rider";
  ui.playerBState.textContent = slotB
    ? `${slotB.ready ? "Ready" : "Syncing"} · x ${slotB.x.toFixed(1)}`
    : "Not connected";
}

function renderResult(message: MatchResultMessage) {
  const localPlayer = latestState?.players.find((player) => player.sessionId === localSessionId);
  const won = localPlayer?.slot && message.winnerSlot === localPlayer.slot;

  if (message.reason === "timeout") {
    ui.resultBanner.textContent = "Whiteout. No clean hit before the storm timer expired.";
    ui.resultBanner.classList.remove("danger");
    return;
  }

  ui.resultBanner.textContent = won
    ? "Direct hit. You won the duel."
    : message.winnerSlot
      ? "Impact confirmed. Opponent took the round."
      : "Round resolved without a winner.";
  ui.resultBanner.classList.toggle("danger", !won);
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
