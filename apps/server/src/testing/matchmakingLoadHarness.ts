import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "@colyseus/sdk";
import type { SlotId } from "@snowbattle/shared";

export interface MatchmakingLoadSummary {
  countByRoomSize: Record<string, number>;
  matchedClientCount: number;
  queuedClientCount: number;
  roomCount: number;
  unmatchedClientCount: number;
}

export interface MatchmakingLoadClientResult {
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

export interface MatchmakingLoadResult {
  clients: MatchmakingLoadClientResult[];
  summary: MatchmakingLoadSummary;
}

export interface MatchmakingLoadOptions {
  allowedQueuedClients: number;
  count: number;
  serverUrl: string;
  timeoutMs?: number;
}

export async function runMatchmakingLoad({
  allowedQueuedClients,
  count,
  serverUrl,
  timeoutMs = 20_000
}: MatchmakingLoadOptions): Promise<MatchmakingLoadResult> {
  const connections = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const client = new Client(serverUrl);
      const room = await client.joinOrCreate("duel", {
        guestName: `Load-${index + 1}`
      });

      const state: MatchmakingLoadClientState = {
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

      room.onLeave(() => {
        if (state.status !== "error" && state.status !== "state") {
          state.detail = "room left before active snapshot";
        }
      });

      room.send("queue:join", { guestName: `Load-${index + 1}` });
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

export async function disposeMatchmakingLoad(result: MatchmakingLoadResult) {
  const rooms = new Set<ReturnType<typeof getRoomHandle>>();

  for (const client of result.clients) {
    const room = getRoomHandle(client);
    if (room) {
      rooms.add(room);
    }
  }

  await Promise.allSettled(
    [...rooms].filter(isRoomHandle).map(async (room) => {
      room.send("player:leave", { reason: "loadtest cleanup" });
      await room.leave(true);
    })
  );
}

export async function startMatchmakingTestServer(port: number) {
  const serverDir = fileURLToPath(new URL("../..", import.meta.url));
  const tsxPath = fileURLToPath(
    new URL("../../../../node_modules/.bin/tsx", import.meta.url)
  );

  const serverProcess = spawn(process.execPath, [tsxPath, "src/server.ts"], {
    cwd: serverDir,
    env: {
      ...process.env,
      CLIENT_ORIGIN: "http://localhost:4173",
      PORT: String(port)
    },
    stdio: "pipe"
  });

  const output: string[] = [];
  serverProcess.stdout?.on("data", (chunk) => {
    output.push(String(chunk));
  });
  serverProcess.stderr?.on("data", (chunk) => {
    output.push(String(chunk));
  });

  await waitForServerReady(port, serverProcess, output);

  return {
    output,
    serverProcess,
    serverUrl: `ws://localhost:${port}`
  };
}

export async function stopMatchmakingTestServer(serverProcess: ChildProcess) {
  if (serverProcess.killed || serverProcess.exitCode !== null) {
    return;
  }

  serverProcess.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    serverProcess.once("exit", () => resolve());
    setTimeout(resolve, 5_000);
  });
}

interface MatchmakingLoadClientState {
  detail: string;
  index: number;
  room: Awaited<ReturnType<Client["joinOrCreate"]>>;
  roomId: string;
  slot: SlotId | null;
  status: MatchmakingLoadClientResult["finalStatus"];
}

function summarizeConnections(
  connections: MatchmakingLoadClientState[]
): MatchmakingLoadResult {
  const clients = connections.map((connection) => ({
    finalStatus: connection.status,
    index: connection.index,
    roomId: connection.roomId,
    room: connection.room,
    slot: connection.slot,
    statusDetail: connection.detail
  }));

  return {
    clients,
    summary: buildSummary(clients)
  };
}

function buildSummary(clients: MatchmakingLoadClientResult[]): MatchmakingLoadSummary {
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

function getRoomHandle(client: MatchmakingLoadClientResult) {
  return client.room;
}

function isRoomHandle(
  room: ReturnType<typeof getRoomHandle>
): room is NonNullable<ReturnType<typeof getRoomHandle>> {
  return Boolean(room);
}

async function waitForServerReady(
  port: number,
  serverProcess: ChildProcess,
  output: string[]
) {
  const readyUrl = `http://localhost:${port}/matchmake/joinOrCreate/duel`;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(
        `Test server exited before ready: ${output.join("") || serverProcess.exitCode}`
      );
    }

    try {
      const response = await fetch(readyUrl, {
        headers: {
          Origin: "http://localhost:4173"
        },
        method: "OPTIONS"
      });

      if (response.status === 204 || response.status === 200) {
        return;
      }
    } catch {
      // Server may still be booting.
    }

    await wait(250);
  }

  throw new Error(`Colyseus server on port ${port} did not become ready: ${output.join("")}`);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
