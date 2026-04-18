import { expect, test, type Page } from "@playwright/test";

test("two browser clients can queue from solo and transition into the live duel", async ({
  browser
}) => {
  test.setTimeout(60_000);

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

  await expect(pageA.getByTestId("solo-queue-toggle")).toBeVisible();
  await expect(pageA.locator("#solo-hero .title")).toBeVisible();

  await pageA.getByTestId("solo-queue-toggle").click();
  await pageB.getByTestId("solo-queue-toggle").click();

  await waitForQueueStatus(pageA, "A", ["queued", "match_found", "countdown", "connected"]);
  await waitForQueueStatus(pageB, "B", ["queued", "match_found", "countdown", "connected"]);

  await waitForLifecycle(pageA, "A", ["countdown"]);
  await waitForLifecycle(pageB, "B", ["countdown"]);
  await expect(pageA.getByTestId("solo-countdown-overlay")).toBeVisible();
  await expect(pageB.getByTestId("solo-countdown-overlay")).toBeVisible();
  await expect(pageA.getByTestId("solo-countdown-value")).toHaveText(/[123]/);
  await expect(pageB.getByTestId("solo-countdown-value")).toHaveText(/[123]/);
  await waitForLifecycle(pageA, "A", ["in_match"]);
  await waitForLifecycle(pageB, "B", ["in_match"]);
  await expect(pageA.getByTestId("solo-countdown-overlay")).toBeHidden();
  await expect(pageB.getByTestId("solo-countdown-overlay")).toBeHidden();

  await expect(pageA.getByTestId("solo-mode")).toHaveText("Live duel");
  await expect(pageB.getByTestId("solo-mode")).toHaveText("Live duel");
  await expect(pageA.getByTestId("solo-local-name")).toHaveText("Alpha");
  await expect(pageA.getByTestId("solo-opponent-name")).toHaveText("Beta");
  await expect(pageB.getByTestId("solo-local-name")).toHaveText("Beta");
  await expect(pageB.getByTestId("solo-opponent-name")).toHaveText("Alpha");
  await expect(pageA.getByTestId("solo-status")).toHaveText("Combat");
  await expect(pageA.getByTestId("solo-timer-badge")).toBeVisible();
  await expect(pageA.getByTestId("solo-build")).toHaveText("combat");
  await expect(pageA.locator("#solo-hero")).toBeHidden();
  await expect(pageB.locator("#solo-hero")).toBeHidden();

  const viewportA = pageA.getByTestId("solo-viewport");
  const viewportBoxA = await viewportA.boundingBox();

  if (!viewportBoxA) {
    throw new Error("Viewport bounds unavailable for page A");
  }

  const structuresBeforeA = await readCounter(pageA, "solo-structures");
  const structuresBeforeB = await readCounter(pageB, "solo-structures");
  await pageA.keyboard.press("1");
  await expect(pageA.getByTestId("solo-status")).toHaveText("Build");
  await expect(pageA.getByTestId("solo-build")).toHaveText("wall");
  const placementPoint = await findValidPlacementPoint(pageA, viewportBoxA);
  await pageA.mouse.move(placementPoint.x, placementPoint.y);
  await pageA.mouse.click(placementPoint.x, placementPoint.y);
  await expect
    .poll(async () => await readCounter(pageA, "solo-structures"))
    .toBeGreaterThan(structuresBeforeA);
  await expect
    .poll(async () => await readCounter(pageB, "solo-structures"))
    .toBeGreaterThan(structuresBeforeB);

  const before = await pageB.getByTestId("solo-opponent-state").textContent();

  await pageA.keyboard.down("d");
  await pageA.waitForTimeout(600);
  await pageA.keyboard.up("d");

  await expect
    .poll(async () => await pageB.getByTestId("solo-opponent-state").textContent())
    .not.toBe(before);

  await contextA.close();
  await contextB.close();
});

async function waitForQueueStatus(
  page: Page,
  label: string,
  acceptedCodes: string[]
) {
  await expect
    .poll(async () => {
      const debug = await readDebugState(page);

      if (debug.statusCode === "error") {
        throw new Error(
          `[${label}] queue error at ${debug.statusStage}: ${debug.queueMeta}`
        );
      }

      return acceptedCodes.includes(debug.statusCode);
    }, { timeout: 30_000 })
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
          `[${label}] lifecycle failed at ${debug.statusStage}: ${debug.queueMeta}`
        );
      }

      return acceptedLifecycle.includes(debug.lifecycle);
    }, { timeout: 30_000 })
    .toBe(true);
}

async function readDebugState(page: Page) {
  const [statusCode, statusStage, queueMeta, roomId, lifecycle] = await Promise.all([
    page.getByTestId("solo-queue-status-code").textContent(),
    page.getByTestId("solo-queue-status-stage").textContent(),
    page.getByTestId("solo-queue-meta").textContent(),
    page.getByTestId("solo-room").textContent(),
    page.getByTestId("solo-lifecycle").textContent()
  ]);

  return {
    lifecycle: lifecycle ?? "",
    queueMeta: queueMeta ?? "",
    roomId: roomId ?? "",
    statusCode: statusCode ?? "",
    statusStage: statusStage ?? ""
  };
}

async function findValidPlacementPoint(
  page: Page,
  box: { x: number; y: number; width: number; height: number }
) {
  const preview = page.getByTestId("solo-preview");
  const columns = [0.3, 0.35, 0.4, 0.45, 0.5];
  const rows = [0.3, 0.35, 0.4, 0.45, 0.5];

  for (const row of rows) {
    for (const column of columns) {
      const point = {
        x: box.x + box.width * column,
        y: box.y + box.height * row
      };
      await page.mouse.move(point.x, point.y);

      if ((await preview.textContent()) === "valid") {
        return point;
      }
    }
  }

  throw new Error("Could not place a build in the duel viewport");
}

async function readCounter(page: Page, testId: string) {
  return parseInt((await page.getByTestId(testId).textContent()) ?? "0", 10);
}
