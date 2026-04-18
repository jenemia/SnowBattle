import {
  disposeBrowserMatchmakingLoad,
  runBrowserMatchmakingLoad,
  type BrowserMatchmakingLoadOptions,
  type BrowserMatchmakingLoadResult
} from "../testing/matchmakingLoadHarness";
import { resolveServerUrl } from "../serverUrl";
import { renderHeroActions } from "./solo-page";

declare global {
  interface Window {
    __matchmakingLoadtestLastResult?: BrowserMatchmakingLoadResult | null;
    __runMatchmakingLoadtest?: (
      options: Omit<BrowserMatchmakingLoadOptions, "serverUrl">
    ) => Promise<BrowserMatchmakingLoadResult>;
  }
}

export function bootMatchmakingLoadtestPage(root: HTMLDivElement) {
  root.innerHTML = `
    <main class="shell shell--loadtest">
      <section class="hero hero--compact">
        <div class="eyebrow">Matchmaking Harness</div>
        <h1 class="title">Snow<span>Battle</span></h1>
        <p class="lede">
          Browser-side verification for large matchmaking runs. This page stays light and exposes
          the Playwright harness without rendering the duel scene.
        </p>
        ${renderHeroActions([
          { href: "./", label: "Back to duel home", testId: "loadtest-home-link" },
          { href: "solo", label: "Open solo movement lab", testId: "loadtest-solo-link" }
        ])}
      </section>
      <section class="arena arena--static">
        <div class="overlay-stack overlay-stack--top-left">
          <section class="overlay-card status-card" data-testid="matchmaking-loadtest-card">
            <div class="status-line status-line--compact">
              <span class="status-pill" data-testid="matchmaking-loadtest-status">Idle</span>
            </div>
            <div class="status-copy" data-testid="matchmaking-loadtest-server">Server --</div>
            <div class="status-copy" data-testid="matchmaking-loadtest-summary">No run yet</div>
          </section>
        </div>
      </section>
    </main>
  `;

  const status = root.querySelector<HTMLElement>("[data-testid='matchmaking-loadtest-status']");
  const serverLabel = root.querySelector<HTMLElement>(
    "[data-testid='matchmaking-loadtest-server']"
  );
  const summaryLabel = root.querySelector<HTMLElement>(
    "[data-testid='matchmaking-loadtest-summary']"
  );

  if (!status || !serverLabel || !summaryLabel) {
    throw new Error("Missing matchmaking loadtest nodes");
  }

  const resolution = resolveServerUrl({
    explicitUrl: import.meta.env.VITE_SERVER_URL,
    hostname: window.location.hostname,
    isProduction: import.meta.env.PROD
  });

  serverLabel.textContent = resolution.serverUrl || resolution.statusDetail;

  if (!resolution.isConfigured) {
    status.textContent = "Backend not configured";
    summaryLabel.textContent = resolution.statusDetail;
    window.__runMatchmakingLoadtest = async () => {
      throw new Error(resolution.statusDetail);
    };
    return;
  }

  let lastResult: BrowserMatchmakingLoadResult | null = null;

  window.__runMatchmakingLoadtest = async (options) => {
    status.textContent = `Running ${options.count}-client harness`;
    summaryLabel.textContent = "Connecting...";

    if (lastResult) {
      await disposeBrowserMatchmakingLoad(lastResult);
      lastResult = null;
      window.__matchmakingLoadtestLastResult = null;
    }

    const result = await runBrowserMatchmakingLoad({
      ...options,
      serverUrl: resolution.serverUrl
    });

    lastResult = result;
    window.__matchmakingLoadtestLastResult = serializeResult(result);
    status.textContent = result.clients.some((client) => client.finalStatus === "error")
      ? "Error"
      : "Completed";
    summaryLabel.textContent = JSON.stringify(result.summary);

    return serializeResult(result);
  };
}

function serializeResult(result: BrowserMatchmakingLoadResult): BrowserMatchmakingLoadResult {
  return {
    clients: result.clients.map((client) => ({
      finalStatus: client.finalStatus,
      index: client.index,
      roomId: client.roomId,
      slot: client.slot,
      statusDetail: client.statusDetail
    })),
    summary: { ...result.summary }
  };
}
