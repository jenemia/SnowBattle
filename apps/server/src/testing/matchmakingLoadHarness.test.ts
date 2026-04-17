import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  disposeMatchmakingLoad,
  runMatchmakingLoad,
  startMatchmakingTestServer,
  stopMatchmakingTestServer
} from "./matchmakingLoadHarness.js";

describe.sequential("matchmaking load harness", () => {
  const port = 2568;
  let server:
    | Awaited<ReturnType<typeof startMatchmakingTestServer>>
    | null = null;

  beforeAll(async () => {
    server = await startMatchmakingTestServer(port);
  }, 30_000);

  afterAll(async () => {
    if (server) {
      await stopMatchmakingTestServer(server.serverProcess);
    }
  }, 15_000);

  it.each([
    { allowedQueuedClients: 0, count: 50, expectedPairs: 25, expectedRoomCount: 25 },
    { allowedQueuedClients: 0, count: 100, expectedPairs: 50, expectedRoomCount: 50 },
    { allowedQueuedClients: 1, count: 51, expectedPairs: 25, expectedRoomCount: 26 }
  ])(
    "matches $count players into 2-seat duel rooms",
    async ({ allowedQueuedClients, count, expectedPairs, expectedRoomCount }) => {
      if (!server) {
        throw new Error("Matchmaking test server missing");
      }

      const result = await runMatchmakingLoad({
        allowedQueuedClients,
        count,
        serverUrl: server.serverUrl
      });

      try {
        const matchedClients = result.clients.filter((client) => client.slot !== null);
        const queuedClients = result.clients.filter((client) => client.slot === null);

        expect(
          result.clients.filter((client) => client.finalStatus === "error"),
          formatDebug(result)
        ).toHaveLength(0);
        expect(result.summary.roomCount, formatDebug(result)).toBe(expectedRoomCount);
        expect(result.summary.countByRoomSize["2"] ?? 0, formatDebug(result)).toBe(
          expectedPairs
        );
        expect(result.summary.countByRoomSize["1"] ?? 0, formatDebug(result)).toBe(
          allowedQueuedClients
        );
        expect(queuedClients, formatDebug(result)).toHaveLength(allowedQueuedClients);
        expect(matchedClients, formatDebug(result)).toHaveLength(count - allowedQueuedClients);

        const roomSlots = new Map<string, string[]>();
        for (const client of matchedClients) {
          const existing = roomSlots.get(client.roomId) ?? [];
          existing.push(client.slot as string);
          roomSlots.set(client.roomId, existing);
        }

        for (const [roomId, slots] of roomSlots) {
          expect(slots, `${roomId}: ${formatDebug(result)}`).toHaveLength(2);
          expect(new Set(slots), `${roomId}: ${formatDebug(result)}`).toEqual(
            new Set(["A", "B"])
          );
        }
      } finally {
        await disposeMatchmakingLoad(result);
      }
    },
    30_000
  );
});

function formatDebug(result: Awaited<ReturnType<typeof runMatchmakingLoad>>) {
  return JSON.stringify(
    {
      clients: result.clients.map((client) => ({
        finalStatus: client.finalStatus,
        index: client.index,
        roomId: client.roomId,
        slot: client.slot,
        statusDetail: client.statusDetail
      })),
      summary: result.summary
    },
    null,
    2
  );
}
