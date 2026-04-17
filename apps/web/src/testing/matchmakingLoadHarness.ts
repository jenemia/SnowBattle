import { Client } from "@colyseus/sdk";
import type { SlotId } from "@snowbattle/shared";

export interface BrowserMatchmakingLoadClientResult {
  finalStatus:
    | "countdown"
    | "error"
    | "match_found"
    | "queued"
    | "state"
    | "timeout";
  index: number;
  roomId: string;
  room?: Awaited<ReturnType<Client["joinOrCreate"]>>;
  slot: SlotId | null;
  statusDetail: string;
}

export interface BrowserMatchmakingLoadResult {
  clients: BrowserMatchmakingLoadClientResult[];
  summary: {
    countByRoomSize: Record<string, number>;
    matchedClientCount: number;
    queuedClientCount: number;
    roomCount: number;
    unmatchedClientCount: number;
  };
}

export interface BrowserMatchmakingLoadOptions {
  allowedQueuedClients?: number;
  count: number;
  serverUrl: string;
  timeoutMs?: number;
}

interface BrowserMatchmakingLoadClientState {
  detail: string;
  index: number;
  room: Awaited<ReturnType<Client["joinOrCreate"]>>;
  roomId: string;
  slot: SlotId | null;
  status: BrowserMatchmakingLoadClientResult["finalStatus"];
}

export async function runBrowserMatchmakingLoad(
  options: BrowserMatchmakingLoadOptions
): Promise<BrowserMatchmakingLoadResult> {
  const allowedQueuedClients = options.allowedQueuedClients ?? 0;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const connections = await Promise.all(
    Array.from({ length: options.count }, async (_, index) => {
      const client = new Client(options.serverUrl);
      const room = await client.joinOrCreate("duel", {
        guestName: `Browser-${index + 1}`
      });
      room.reconnection.enabled = false;
      const state: BrowserMatchmakingLoadClientState = {
        detail: "joined room",
        index,
        room,
        roomId: room.roomId,
        slot: null,
        status: "queued"
      };

      room.onMessage("server:queue_status", () => {
        state.status = "queued";
        state.detail = "queue_status";
      });
      room.onMessage("server:match_found", (message) => {
        state.status = "match_found";
        state.slot = message.slot;
        state.detail = `match_found:${message.slot}`;
      });
      room.onMessage("server:countdown", () => {
        if (state.status !== "state") {
          state.status = "countdown";
        }
        state.detail = "countdown";
      });
      room.onMessage("server:state", (message) => {
        state.status = "state";
        state.slot = message.snapshot.localPlayer.slot;
        state.detail = `state:${message.snapshot.match.lifecycle}`;
      });
      room.onMessage("server:requeue", () => {
        if (state.status === "queued") {
          state.detail = "requeue";
        }
      });
      room.onError((code, message) => {
        state.status = "error";
        state.detail = `room error ${code}: ${message}`;
      });

      room.send("queue:join", { guestName: `Browser-${index + 1}` });
      room.send("player:ready", { ready: true });
      return state;
    })
  );

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = summarizeConnections(connections);

    if (result.summary.unmatchedClientCount <= allowedQueuedClients) {
      return result;
    }

    if (result.clients.some((client) => client.finalStatus === "error")) {
      return result;
    }

    await wait(100);
  }

  const timedOut = summarizeConnections(connections);
  for (const client of timedOut.clients) {
    if (client.finalStatus === "queued") {
      client.finalStatus = "timeout";
      client.statusDetail = `${client.statusDetail} (timed out)`;
    }
  }
  timedOut.summary = buildSummary(timedOut.clients);

  return timedOut;
}

export async function disposeBrowserMatchmakingLoad(result: BrowserMatchmakingLoadResult) {
  const rooms = new Set(
    result.clients
      .map((client) => client.room)
      .filter((room): room is Awaited<ReturnType<Client["joinOrCreate"]>> => Boolean(room))
  );

  await Promise.allSettled(
    [...rooms].map(async (room) => {
      room.send("player:leave", { reason: "browser loadtest cleanup" });
      await room.leave(true);
    })
  );
}

function summarizeConnections(
  connections: BrowserMatchmakingLoadClientState[]
): BrowserMatchmakingLoadResult {
  const clients = connections.map((connection) => ({
    finalStatus: connection.status,
    index: connection.index,
    room: connection.room,
    roomId: connection.roomId,
    slot: connection.slot,
    statusDetail: connection.detail
  }));

  return {
    clients,
    summary: buildSummary(clients)
  };
}

function buildSummary(clients: BrowserMatchmakingLoadClientResult[]) {
  const roomOccupancy = new Map<string, number>();

  for (const client of clients) {
    roomOccupancy.set(client.roomId, (roomOccupancy.get(client.roomId) ?? 0) + 1);
  }

  const countByRoomSize: Record<string, number> = {};
  for (const size of roomOccupancy.values()) {
    const key = String(size);
    countByRoomSize[key] = (countByRoomSize[key] ?? 0) + 1;
  }

  const queuedClientCount = clients.filter((client) =>
    client.slot === null
  ).length;
  const matchedClientCount = clients.filter((client) => client.slot !== null).length;

  return {
    countByRoomSize,
    matchedClientCount,
    queuedClientCount,
    roomCount: roomOccupancy.size,
    unmatchedClientCount: clients.length - matchedClientCount
  };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
