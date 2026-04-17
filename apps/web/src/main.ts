import "./styles.css";

import { bootMatchmakingLoadtestPage } from "./routes/bootMatchmakingLoadtestPage";
import { bootMultiplayerPage } from "./routes/bootMultiplayerPage";
import { bootSoloPage } from "./routes/bootSoloPage";
import { initSentry } from "./sentry";

initSentry();

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app mount");
}

const route = resolveRoute(window.location.pathname);

if (route === "solo") {
  bootSoloPage(root);
} else if (route === "matchmaking-loadtest") {
  bootMatchmakingLoadtestPage(root);
} else {
  bootMultiplayerPage(root);
}

function resolveRoute(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized.endsWith("/matchmaking-loadtest")) {
    return "matchmaking-loadtest";
  }
  return normalized.endsWith("/solo") ? "solo" : "home";
}
