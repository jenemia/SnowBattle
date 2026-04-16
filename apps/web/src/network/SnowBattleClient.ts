import { Client } from "@colyseus/sdk";
import type {
  CountdownMessage,
  MatchFoundMessage,
  MatchResultMessage,
  QueueStatusMessage,
  RequeuePromptMessage,
  StateSnapshotMessage
} from "@snowbattle/shared";

interface MessageHandlers {
  onCountdown: (message: CountdownMessage) => void;
  onMatchFound: (message: MatchFoundMessage) => void;
  onQueueStatus: (message: QueueStatusMessage) => void;
  onRequeue: (message: RequeuePromptMessage) => void;
  onResult: (message: MatchResultMessage) => void;
  onState: (message: StateSnapshotMessage) => void;
  onStatusChange: (value: string) => void;
}

interface InputPayload {
  fire: boolean;
  moveX: number;
  moveY: number;
  pointerAngle: number;
  sequence: number;
}

export class SnowBattleClient {
  private readonly client: Client;
  private room: Awaited<ReturnType<Client["joinOrCreate"]>> | null = null;
  private heartbeatTimer: number | null = null;

  constructor(serverUrl: string, private readonly handlers: MessageHandlers) {
    this.client = new Client(serverUrl);
  }

  get sessionId() {
    return this.room?.sessionId ?? null;
  }

  async queue(guestName: string) {
    this.handlers.onStatusChange("Searching for a duel...");

    this.room = await this.client.joinOrCreate("duel", { guestName });
    this.bindRoom();
    this.room.send("queue:join", { guestName });
    this.room.send("player:ready", { ready: true });
    this.startHeartbeat();
    this.handlers.onStatusChange("Connected. Waiting for snowbound contact.");
  }

  sendInput(payload: InputPayload) {
    this.room?.send("player:input", payload);
  }

  async leave(reason = "manual") {
    if (!this.room) {
      return;
    }

    this.room.send("player:leave", { reason });
    await this.room.leave();
    this.stopHeartbeat();
    this.room = null;
  }

  private bindRoom() {
    if (!this.room) {
      return;
    }

    this.room.onMessage("server:queue_status", (message: QueueStatusMessage) => {
      this.handlers.onQueueStatus(message);
    });
    this.room.onMessage("server:match_found", (message: MatchFoundMessage) => {
      this.handlers.onMatchFound(message);
    });
    this.room.onMessage("server:countdown", (message: CountdownMessage) => {
      this.handlers.onCountdown(message);
    });
    this.room.onMessage("server:state", (message: StateSnapshotMessage) => {
      this.handlers.onState(message);
    });
    this.room.onMessage("server:result", (message: MatchResultMessage) => {
      this.handlers.onResult(message);
    });
    this.room.onMessage("server:requeue", (message: RequeuePromptMessage) => {
      this.handlers.onRequeue(message);
    });
    this.room.onLeave(() => {
      this.stopHeartbeat();
      this.handlers.onStatusChange("Connection closed. Requeue to jump back in.");
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.room?.send("player:heartbeat", { sentAt: Date.now() });
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
