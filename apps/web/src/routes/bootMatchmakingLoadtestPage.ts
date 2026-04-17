import {
  disposeBrowserMatchmakingLoad,
  runBrowserMatchmakingLoad,
  type BrowserMatchmakingLoadOptions,
  type BrowserMatchmakingLoadResult
} from "../testing/matchmakingLoadHarness";
import { resolveServerUrl } from "../serverUrl";

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
    <main class="shell">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Matchmaking Harness</span>
          <h1>Browser-side large matchmaking verification</h1>
          <p>
            This page stays lightweight and exposes a Playwright harness that spawns Colyseus
            clients inside the browser without rendering the duel scene.
          </p>
        </div>
        <div class="panel panel-stack">
          <div class="result" data-testid="matchmaking-loadtest-status">Idle</div>
          <div class="solo-debug" data-testid="matchmaking-loadtest-server">Server --</div>
          <div class="solo-debug" data-testid="matchmaking-loadtest-summary">No run yet</div>
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
