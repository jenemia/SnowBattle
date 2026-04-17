import type { Client } from "colyseus";
import { Room } from "colyseus";
import type {
  CountdownMessage,
  MatchLifecycle,
  MatchFoundMessage,
  QueueStatusMessage,
  RequeuePromptMessage,
  StateSnapshotMessage
} from "@snowbattle/shared";
import { parseClientMessage } from "@snowbattle/shared";

import { DuelMatchController } from "../core/DuelMatchController.js";
import {
  DuelRoomMessageCache,
  getStateDispatchMode,
  quantizeCountdownRemainingMs
} from "./duelRoomTransport.js";
import { queueRegistry } from "../services/QueueRegistry.js";

interface DuelJoinOptions {
  guestName?: string;
}

export class DuelRoom extends Room {
  maxClients = 2;
  private controller!: DuelMatchController;
  private lastLifecycle: MatchLifecycle = "waiting";
  private lastCountdownValue = Number.NaN;
  private readonly messageCache = new DuelRoomMessageCache();
  private resultBroadcastAt = 0;

  onCreate() {
    this.autoDispose = true;
    this.controller = new DuelMatchController(this.roomId);
    this.lastLifecycle = this.controller.lifecycle;

    this.onMessage("queue:join", (client, payload) => {
      const parsed = parseClientMessage("queue:join", payload);

      if (!parsed.success) {
        return;
      }

      this.controller.updateGuestName(client.sessionId, parsed.data.guestName);
      this.sendQueueStatus(client);
    });

    this.onMessage("player:ready", (client, payload) => {
      const parsed = parseClientMessage("player:ready", payload);

      if (!parsed.success) {
        return;
      }

      this.controller.setReady(client.sessionId, parsed.data.ready);

      if (this.controller.maybeStartCountdown(Date.now())) {
        this.lock();
      }
    });

    this.onMessage("session:command", (client, payload) => {
      const parsed = parseClientMessage("session:command", payload);

      if (!parsed.success) {
        return;
      }

      this.controller.receiveCommand(client.sessionId, parsed.data);
    });

    this.onMessage("player:heartbeat", (client, payload) => {
      const parsed = parseClientMessage("player:heartbeat", payload);

      if (!parsed.success) {
        return;
      }

      client.send("server:pong", {
        status: "pong",
        roomId: this.roomId,
        receivedAt: parsed.data.sentAt
      });
    });

    this.onMessage("player:leave", (client) => {
      client.leave();
    });

    this.setSimulationInterval((deltaTime) => {
      const now = Date.now();
      const previousLifecycle = this.lastLifecycle;
      this.controller.tick(deltaTime, now);
      this.syncQueueMetadata();
      this.broadcastLifecycleMessages(now, previousLifecycle);
      this.pushState(getStateDispatchMode(this.controller.lifecycle, previousLifecycle));
    }, 1000 / 20);
  }

  onJoin(client: Client, options: DuelJoinOptions) {
    const player = this.controller.addPlayer({
      sessionId: client.sessionId,
      guestName: options.guestName
    });

    this.syncQueueMetadata();

    if (this.clients.length === 1) {
      this.unlock();
      this.sendQueueStatus(client, true);
      return;
    }

    const matchFoundMessage: MatchFoundMessage = {
      status: "match_found",
      roomId: this.roomId,
      slot: player.slot,
      opponentGuestName: this.controller.getOpponentGuestName(player.slot),
      countdownFrom: 3000
    };

    client.send("server:match_found", matchFoundMessage);

    for (const roomClient of this.clients) {
      const slot = this.controller
        .getPlayers()
        .find((entry) => entry.sessionId === roomClient.sessionId)?.slot;

      if (!slot) {
        continue;
      }

      roomClient.send("server:match_found", {
        status: "match_found",
        roomId: this.roomId,
        slot,
        opponentGuestName: this.controller.getOpponentGuestName(slot),
        countdownFrom: 3000
      } satisfies MatchFoundMessage);
    }
  }

  onLeave(client: Client) {
    this.messageCache.clearClient(client.sessionId);

    const { remainingPlayers, result, shouldResetToWaiting } =
      this.controller.removePlayer(client.sessionId, "forfeit");

    this.syncQueueMetadata();

    if (remainingPlayers === 0) {
      this.disconnect();
      return;
    }

    if (shouldResetToWaiting) {
      this.unlock();
      const prompt: RequeuePromptMessage = {
        status: "requeue",
        roomId: this.roomId,
        available: true,
        message: "Opponent left. Holding your spot while we wait for the next rider."
      };

      this.broadcastIfChanged("server:requeue", prompt, true);
    }

    if (result) {
      this.lock();
      this.broadcastIfChanged("server:result", result, true);
    }
  }

  onDispose() {
    queueRegistry.removeRoom(this.roomId);
  }

  private sendQueueStatus(client: Client, force = false) {
    const message: QueueStatusMessage = {
      status: "queued",
      position: queueRegistry.getPosition(this.roomId),
      queuedPlayers: queueRegistry.getQueuedPlayers(),
      roomId: this.roomId
    };

    this.sendIfChanged(client, "server:queue_status", message, force);
  }

  private syncQueueMetadata() {
    const waitingPlayers =
      this.controller.lifecycle === "waiting" && this.clients.length === 1 ? 1 : 0;

    queueRegistry.updateRoom(this.roomId, waitingPlayers);
  }

  private broadcastLifecycleMessages(now: number, previousLifecycle: MatchLifecycle) {
    if (previousLifecycle !== this.controller.lifecycle) {
      this.resetLifecycleMessageCache(this.controller.lifecycle);
    }

    if (this.controller.lifecycle === "countdown") {
      const remainingMs = quantizeCountdownRemainingMs(
        this.controller.getCountdownRemaining(now)
      );

      if (remainingMs !== this.lastCountdownValue) {
        this.broadcastIfChanged("server:countdown", {
          status: "countdown",
          roomId: this.roomId,
          remainingMs
        } satisfies CountdownMessage);
        this.lastCountdownValue = remainingMs;
      }
    } else {
      this.lastCountdownValue = Number.NaN;
    }

    if (
      this.controller.lifecycle === "finished" &&
      this.resultBroadcastAt === 0 &&
      this.controller.getMatchResult()
    ) {
      this.broadcastIfChanged("server:result", this.controller.getMatchResult()!, true);
      this.broadcastIfChanged("server:requeue", {
        status: "requeue",
        roomId: this.roomId,
        available: true,
        message: "Round complete. Leave the room to instantly queue again."
      } satisfies RequeuePromptMessage, true);
      this.resultBroadcastAt = now;
    }

    if (this.controller.lifecycle !== "finished") {
      this.resultBroadcastAt = 0;
    }

    if (previousLifecycle !== this.controller.lifecycle) {
      if (this.controller.lifecycle === "waiting" && this.clients.length === 1) {
        this.sendQueueStatus(this.clients[0], true);
      }

      this.lastLifecycle = this.controller.lifecycle;
    }
  }

  private pushState(mode: ReturnType<typeof getStateDispatchMode>, target?: Client) {
    if (mode === "idle") {
      return;
    }

    const force = mode === "transition";

    if (target) {
      const snapshot = this.controller.getSnapshotFor(target.sessionId);

      if (snapshot) {
        this.sendIfChanged(target, "server:state", {
          status: "state",
          roomId: this.roomId,
          snapshot
        } satisfies StateSnapshotMessage, force);
      } else {
        this.messageCache.delete("server:state", target.sessionId);
      }
      return;
    }

    for (const client of this.clients) {
      const snapshot = this.controller.getSnapshotFor(client.sessionId);

      if (!snapshot) {
        this.messageCache.delete("server:state", client.sessionId);
        continue;
      }

      this.sendIfChanged(client, "server:state", {
        status: "state",
        roomId: this.roomId,
        snapshot
      } satisfies StateSnapshotMessage, force);
    }
  }

  private broadcastIfChanged<TPayload>(channel: string, payload: TPayload, force = false) {
    for (const client of this.clients) {
      this.sendIfChanged(client, channel, payload, force);
    }
  }

  private resetLifecycleMessageCache(nextLifecycle: MatchLifecycle) {
    this.messageCache.clearChannel("server:countdown");
    this.messageCache.clearChannel("server:queue_status");
    this.messageCache.clearChannel("server:requeue");
    this.messageCache.clearChannel("server:result");

    if (nextLifecycle !== "in_match") {
      this.messageCache.clearChannel("server:state");
    }
  }

  private sendIfChanged<TPayload>(
    client: Client,
    channel: string,
    payload: TPayload,
    force = false
  ) {
    if (!this.messageCache.shouldSend(channel, client.sessionId, payload, force)) {
      return;
    }

    client.send(channel, payload);
  }
}
