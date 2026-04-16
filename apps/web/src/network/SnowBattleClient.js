import { Client } from "@colyseus/sdk";
export class SnowBattleClient {
    handlers;
    client;
    room = null;
    heartbeatTimer = null;
    constructor(serverUrl, handlers) {
        this.handlers = handlers;
        this.client = new Client(serverUrl);
    }
    get sessionId() {
        return this.room?.sessionId ?? null;
    }
    async queue(guestName) {
        this.handlers.onStatusChange("Searching for a duel...");
        this.room = await this.client.joinOrCreate("duel", { guestName });
        this.bindRoom();
        this.room.send("queue:join", { guestName });
        this.room.send("player:ready", { ready: true });
        this.startHeartbeat();
        this.handlers.onStatusChange("Connected. Waiting for snowbound contact.");
    }
    sendInput(payload) {
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
    bindRoom() {
        if (!this.room) {
            return;
        }
        this.room.onMessage("server:queue_status", (message) => {
            this.handlers.onQueueStatus(message);
        });
        this.room.onMessage("server:match_found", (message) => {
            this.handlers.onMatchFound(message);
        });
        this.room.onMessage("server:countdown", (message) => {
            this.handlers.onCountdown(message);
        });
        this.room.onMessage("server:state", (message) => {
            this.handlers.onState(message);
        });
        this.room.onMessage("server:result", (message) => {
            this.handlers.onResult(message);
        });
        this.room.onMessage("server:requeue", (message) => {
            this.handlers.onRequeue(message);
        });
        this.room.onLeave(() => {
            this.stopHeartbeat();
            this.handlers.onStatusChange("Connection closed. Requeue to jump back in.");
        });
    }
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = window.setInterval(() => {
            this.room?.send("player:heartbeat", { sentAt: Date.now() });
        }, 5000);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer !== null) {
            window.clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
