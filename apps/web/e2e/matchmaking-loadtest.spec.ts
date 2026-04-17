import { expect, test } from "@playwright/test";

interface MatchmakingLoadResult {
  clients: Array<{
    finalStatus: string;
    index: number;
    roomId: string;
    slot: string | null;
    statusDetail: string;
  }>;
  summary: {
    countByRoomSize: Record<string, number>;
    matchedClientCount: number;
    queuedClientCount: number;
    roomCount: number;
    unmatchedClientCount: number;
  };
}

test.describe("matchmaking load harness", () => {
  test.setTimeout(120_000);

  for (const scenario of [
    { allowedQueuedClients: 0, count: 50, expectedPairs: 25, expectedRoomCount: 25 },
    { allowedQueuedClients: 0, count: 100, expectedPairs: 50, expectedRoomCount: 50 }
  ]) {
    test(`matches ${scenario.count} browser clients into 2-seat rooms`, async ({ page }) => {
      await page.goto("/matchmaking-loadtest");

      const result = await page.evaluate<MatchmakingLoadResult, {
        allowedQueuedClients: number;
        count: number;
        expectedPairs: number;
        expectedRoomCount: number;
      }>(async (options) => {
        if (!window.__runMatchmakingLoadtest) {
          throw new Error("matchmaking harness missing");
        }

        return await window.__runMatchmakingLoadtest(options);
      }, scenario);

      expect(
        result.clients.filter((client) => client.finalStatus === "error"),
        formatDebug(result)
      ).toHaveLength(0);
      expect(result.summary.roomCount, formatDebug(result)).toBe(
        scenario.expectedRoomCount
      );
      expect(result.summary.countByRoomSize["2"] ?? 0, formatDebug(result)).toBe(
        scenario.expectedPairs
      );
      expect(result.summary.countByRoomSize["1"] ?? 0, formatDebug(result)).toBe(
        scenario.allowedQueuedClients
      );
      expect(result.summary.unmatchedClientCount, formatDebug(result)).toBe(
        scenario.allowedQueuedClients
      );

      const matchedClients = result.clients.filter((client) => client.slot !== null);
      const roomSlots = new Map<string, string[]>();
      for (const client of matchedClients) {
        const slots = roomSlots.get(client.roomId) ?? [];
        slots.push(client.slot as string);
        roomSlots.set(client.roomId, slots);
      }

      for (const [roomId, slots] of roomSlots) {
        expect(slots, `${roomId}: ${formatDebug(result)}`).toHaveLength(2);
        expect(new Set(slots), `${roomId}: ${formatDebug(result)}`).toEqual(
          new Set(["A", "B"])
        );
      }
    });
  }
});

function formatDebug(result: MatchmakingLoadResult) {
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
