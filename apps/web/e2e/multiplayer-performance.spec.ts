import { expect, test, type Page } from "@playwright/test";

test("dual mode keeps input flushes and layout reads near the 20Hz budget", async ({
  browser
}) => {
  test.setTimeout(60_000);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.addInitScript(instrumentPerformance);
  await pageB.addInitScript(instrumentPerformance);
  await pageA.addInitScript(() => {
    window.localStorage.setItem("snowbattle.guestName", "Alpha");
  });
  await pageB.addInitScript(() => {
    window.localStorage.setItem("snowbattle.guestName", "Beta");
  });

  await pageA.goto("/");
  await pageB.goto("/");

  await pageA.getByTestId("solo-queue-toggle").click();
  await pageB.getByTestId("solo-queue-toggle").click();

  await waitForLifecycle(pageA, ["in_match"]);
  await waitForLifecycle(pageB, ["in_match"]);

  await pageA.evaluate(() => {
    Object.assign(window.__perfStats, {
      bboxCalls: 0,
      recv: 0,
      recvBytes: 0,
      sent: 0,
      sentBytes: 0
    });
  });
  await pageB.evaluate(() => {
    Object.assign(window.__perfStats, {
      bboxCalls: 0,
      recv: 0,
      recvBytes: 0,
      sent: 0,
      sentBytes: 0
    });
  });

  for (const page of [pageA, pageB]) {
    const viewport = page.getByTestId("solo-viewport");
    const box = await viewport.boundingBox();

    if (!box) {
      throw new Error("Viewport bounds unavailable");
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }

  await pageA.keyboard.down("d");
  await pageB.keyboard.down("a");
  await pageA.waitForTimeout(2_000);
  await pageA.keyboard.up("d");
  await pageB.keyboard.up("a");

  const statsA = await pageA.evaluate(() => window.__perfStats);
  const statsB = await pageB.evaluate(() => window.__perfStats);

  for (const stats of [statsA, statsB]) {
    expect(stats.sent).toBeLessThanOrEqual(42);
    expect(stats.bboxCalls).toBeLessThanOrEqual(stats.sent + 2);
    expect(stats.recv).toBeGreaterThan(0);
  }

  await contextA.close();
  await contextB.close();
});

async function waitForLifecycle(page: Page, acceptedLifecycle: string[]) {
  await expect
    .poll(async () => {
      const [lifecycle, statusCode, statusStage, queueMeta] = await Promise.all([
        page.getByTestId("solo-lifecycle").textContent(),
        page.getByTestId("solo-queue-status-code").textContent(),
        page.getByTestId("solo-queue-status-stage").textContent(),
        page.getByTestId("solo-queue-meta").textContent()
      ]);

      if (statusCode === "error") {
        throw new Error(`provider error at ${statusStage}: ${queueMeta}`);
      }

      return acceptedLifecycle.includes(lifecycle ?? "");
    }, { timeout: 30_000 })
    .toBe(true);
}

function instrumentPerformance() {
  const NativeWebSocket = window.WebSocket;
  window.__perfStats = {
    bboxCalls: 0,
    recv: 0,
    recvBytes: 0,
    sent: 0,
    sentBytes: 0
  };
  const stats = window.__perfStats;
  const sizeof = (data: unknown) => {
    if (typeof data === "string") {
      return data.length;
    }

    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }

    if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }

    if (data instanceof Blob) {
      return data.size;
    }

    return 0;
  };

  class InstrumentedWebSocket extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      this.addEventListener("message", (event) => {
        stats.recv += 1;
        stats.recvBytes += sizeof(event.data);
      });
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      stats.sent += 1;
      stats.sentBytes += sizeof(data);
      return super.send(data);
    }
  }

  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"] as const) {
    Object.defineProperty(InstrumentedWebSocket, key, {
      value: NativeWebSocket[key]
    });
  }

  window.WebSocket = InstrumentedWebSocket;

  const originalRect = HTMLCanvasElement.prototype.getBoundingClientRect;
  HTMLCanvasElement.prototype.getBoundingClientRect = function (...args) {
    stats.bboxCalls += 1;
    return originalRect.apply(this, args);
  };
}
