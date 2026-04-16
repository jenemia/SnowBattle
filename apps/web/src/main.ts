import "./styles.css";

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
} else {
  bootMultiplayerPage(root);
}

function resolveRoute(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized.endsWith("/solo") ? "solo" : "home";
}
