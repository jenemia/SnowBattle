import { expect, test, type Page } from "@playwright/test";

test("two browser clients stay in sync through the shared duel provider", async ({
  browser
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.addInitScript(() => {
    window.localStorage.setItem("snowbattle.guestName", "Alpha");
  });
  await pageB.addInitScript(() => {
    window.localStorage.setItem("snowbattle.guestName", "Beta");
  });

  await pageA.goto("/");
  await pageB.goto("/");

  await waitForStatus(pageA, "A", ["queued", "match_found", "countdown", "connected"]);
  await waitForRoomAssignment(pageA, "A");

  await waitForStatus(pageB, "B", ["queued", "match_found", "countdown", "connected"]);
  await waitForRoomAssignment(pageB, "B");

  await waitForStatus(pageA, "A", ["match_found", "countdown", "connected"]);
  await waitForStatus(pageB, "B", ["match_found", "countdown", "connected"]);

  await waitForLifecycle(pageA, "A", ["countdown", "in_match"]);
  await waitForLifecycle(pageB, "B", ["countdown", "in_match"]);

  await waitForLifecycle(pageA, "A", ["in_match"]);
  await waitForLifecycle(pageB, "B", ["in_match"]);

  await expect(pageA.getByTestId("multiplayer-local-name")).toHaveText("Alpha");
  await expect(pageA.getByTestId("multiplayer-opponent-name")).toHaveText("Beta");
  await expect(pageB.getByTestId("multiplayer-local-name")).toHaveText("Beta");
  await expect(pageB.getByTestId("multiplayer-opponent-name")).toHaveText("Alpha");

  const before = await pageB.getByTestId("multiplayer-opponent-state").textContent();

  await pageA.keyboard.down("d");
  await pageA.waitForTimeout(600);
  await pageA.keyboard.up("d");

  await expect
    .poll(async () => await pageB.getByTestId("multiplayer-opponent-state").textContent())
    .not.toBe(before);

  await contextA.close();
  await contextB.close();
});

async function waitForStatus(
  page: Page,
  label: string,
  acceptedCodes: string[]
) {
  await expect
    .poll(async () => {
      const debug = await readDebugState(page);

      if (debug.statusCode === "error") {
        throw new Error(
          `[${label}] provider error at ${debug.statusStage}: ${debug.statusDetail}`
        );
      }

      return acceptedCodes.includes(debug.statusCode);
    })
    .toBe(true);
}

async function waitForRoomAssignment(
  page: Page,
  label: string
) {
  await expect
    .poll(async () => {
      const debug = await readDebugState(page);

      if (debug.statusCode === "error") {
        throw new Error(
          `[${label}] room assignment failed at ${debug.statusStage}: ${debug.statusDetail}`
        );
      }

      return debug.roomId !== "Room --";
    })
    .toBe(true);
}

async function waitForLifecycle(
  page: Page,
  label: string,
  acceptedLifecycle: string[]
) {
  await expect
    .poll(async () => {
      const debug = await readDebugState(page);

      if (debug.statusCode === "error") {
        throw new Error(
          `[${label}] lifecycle failed at ${debug.statusStage}: ${debug.statusDetail}`
        );
      }

      return acceptedLifecycle.includes(debug.lifecycle);
    })
    .toBe(true);
}

async function readDebugState(page: Page) {
  const [statusCode, statusStage, statusDetail, roomId, lifecycle] = await Promise.all([
    page.getByTestId("multiplayer-status-code").textContent(),
    page.getByTestId("multiplayer-status-stage").textContent(),
    page.getByTestId("multiplayer-status-detail").textContent(),
    page.getByTestId("multiplayer-room").textContent(),
    page.getByTestId("multiplayer-lifecycle").textContent()
  ]);

  return {
    lifecycle: lifecycle ?? "",
    roomId: roomId ?? "",
    statusCode: statusCode ?? "",
    statusDetail: statusDetail ?? "",
    statusStage: statusStage ?? ""
  };
}
