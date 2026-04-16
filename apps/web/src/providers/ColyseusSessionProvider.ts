import { Client } from "@colyseus/sdk";
import {
  HEARTBEAT_INTERVAL_MS,
  type CountdownMessage,
  type GameSessionProvider,
  type MatchFoundMessage,
  type QueueStatusMessage,
  type RequeuePromptMessage,
  type SessionCommand,
  type SessionProviderEvent,
  type SessionSnapshot,
  type StateSnapshotMessage
} from "@snowbattle/shared";

type RoomConnection = Awaited<ReturnType<Client["joinOrCreate"]>>;

export class ColyseusSessionProvider implements GameSessionProvider {
  private connectPromise: Promise<void> | null = null;
  private readonly client: Client;
  private readonly eventListeners = new Set<(event: SessionProviderEvent) => void>();
  private heartbeatTimer: number | null = null;
  private latestSnapshot: SessionSnapshot | null = null;
  private readonly listeners = new Set<(snapshot: SessionSnapshot) => void>();
  private room: RoomConnection | null = null;

  constructor(
    private readonly serverUrl: string,
    private readonly getGuestName: () => string
  ) {
    this.client = new Client(serverUrl);
  }

  async connect() {
    if (this.room) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.joinRoom();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect() {
    const room = this.room;
    this.stopHeartbeat();
    this.room = null;

    if (!room) {
      return;
    }

    room.send("player:leave", { reason: "manual" });
    await room.leave();
    this.emitEvent({
      type: "status",
      code: "disconnected",
      detail: "manual leave requested",
      message: "Connection closed. Requeue to jump back in.",
      serverUrl: this.serverUrl,
      stage: "room_leave"
    });
  }

  send(command: SessionCommand) {
    this.room?.send("session:command", command);
  }

  subscribe(listener: (snapshot: SessionSnapshot) => void) {
    this.listeners.add(listener);

    if (this.latestSnapshot) {
      listener(this.latestSnapshot);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeEvent(listener: (event: SessionProviderEvent) => void) {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  getLatestSnapshot() {
    return this.latestSnapshot;
  }

  private async joinRoom() {
    const guestName = this.getGuestName().trim();
    this.emitEvent({
      type: "status",
      attempt: 1,
      code: "connecting",
      detail: `connecting to ${this.serverUrl}`,
      message: "Searching for a duel...",
      serverUrl: this.serverUrl,
      stage: "connect"
    });

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        this.emitEvent({
          type: "status",
          attempt: attempt + 1,
          code: "connecting",
          detail: `joinOrCreate duel via ${this.serverUrl}`,
          message: `Connecting attempt ${attempt + 1}/5`,
          serverUrl: this.serverUrl,
          stage: "matchmake"
        });
        const room = await this.client.joinOrCreate("duel", { guestName });
        this.room = room;
        this.bindRoom(room);
        room.send("queue:join", { guestName });
        room.send("player:ready", { ready: true });
        this.startHeartbeat();
        this.emitEvent({
          type: "status",
          code: "connected",
          detail: `room ${room.roomId} joined and ready sent`,
          message: "Connected. Waiting for snowbound contact.",
          serverUrl: this.serverUrl,
          stage: "room_join"
        });
        return;
      } catch (error) {
        lastError = error;
        this.emitEvent({
          type: "status",
          attempt: attempt + 1,
          code: "connecting",
          detail: `joinOrCreate failed: ${formatError(error)}`,
          message: `Retrying duel connection (${attempt + 1}/5)`,
          serverUrl: this.serverUrl,
          stage: "matchmake"
        });
        await wait(250 * (attempt + 1));
      }
    }

    const failure = lastError ?? new Error("Unable to join duel room");
    this.emitEvent({
      type: "status",
      attempt: 5,
      code: "error",
      detail: formatError(failure),
      message: "Backend connection failed",
      serverUrl: this.serverUrl,
      stage: "matchmake"
    });
    throw failure;
  }

  private bindRoom(room: RoomConnection) {
    room.onMessage("server:queue_status", (message: QueueStatusMessage) => {
      this.emitEvent({
        type: "queue",
        position: message.position,
        queuedPlayers: message.queuedPlayers,
        roomId: message.roomId
      });
      this.emitEvent({
        type: "status",
        code: "queued",
        detail: `room ${message.roomId} position ${message.position}`,
        message: `Queued · Position ${message.position}`,
        serverUrl: this.serverUrl,
        stage: "room_join"
      });
    });

    room.onMessage("server:match_found", (message: MatchFoundMessage) => {
      this.emitEvent({
        type: "match_found",
        countdownFrom: message.countdownFrom,
        opponentGuestName: message.opponentGuestName,
        roomId: message.roomId,
        slot: message.slot
      });
      this.emitEvent({
        type: "status",
        code: "match_found",
        detail: `room ${message.roomId} vs ${message.opponentGuestName}`,
        message: `Match found · Slot ${message.slot}`,
        serverUrl: this.serverUrl,
        stage: "room_join"
      });
    });

    room.onMessage("server:countdown", (message: CountdownMessage) => {
      this.emitEvent({
        type: "status",
        code: "countdown",
        detail: `${message.remainingMs}ms remaining`,
        message: `Countdown ${Math.ceil(message.remainingMs / 1000)}s`,
        serverUrl: this.serverUrl,
        stage: "room_join"
      });
      this.emitEvent({
        type: "countdown",
        remainingMs: message.remainingMs,
        roomId: message.roomId
      });
    });

    room.onMessage("server:state", (message: StateSnapshotMessage) => {
      this.latestSnapshot = message.snapshot;
      this.emit();
    });

    room.onMessage("server:requeue", (message: RequeuePromptMessage) => {
      this.emitEvent({
        type: "requeue",
        available: message.available,
        message: message.message,
        roomId: message.roomId
      });
      this.emitEvent({
        type: "status",
        code: "requeue",
        detail: message.message,
        message: message.message,
        serverUrl: this.serverUrl,
        stage: "room_join"
      });
    });

    room.onError((code, message) => {
      this.emitEvent({
        type: "status",
        code: "error",
        detail: `room error ${code}: ${message}`,
        message: "Backend connection failed",
        serverUrl: this.serverUrl,
        stage: "room_join"
      });
    });

    room.onLeave(() => {
      this.stopHeartbeat();
      this.room = null;
      this.emitEvent({
        type: "status",
        code: "disconnected",
        detail: "room.onLeave received",
        message: "Connection closed. Requeue to jump back in.",
        serverUrl: this.serverUrl,
        stage: "room_leave"
      });
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.room?.send("player:heartbeat", { sentAt: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private emit() {
    if (!this.latestSnapshot) {
      return;
    }

    for (const listener of this.listeners) {
      listener(this.latestSnapshot);
    }
  }

  private emitEvent(event: SessionProviderEvent) {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
