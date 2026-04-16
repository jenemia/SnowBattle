import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const serverDir = fileURLToPath(new URL("..", import.meta.url));
const tsxPath = fileURLToPath(
  new URL("../../../node_modules/.bin/tsx", import.meta.url)
);

const serverProcess = spawn(
  process.execPath,
  [tsxPath, "src/server.ts"],
  {
    cwd: serverDir,
    stdio: "inherit"
  }
);

const shutdown = (signal) => {
  if (!serverProcess.killed) {
    serverProcess.kill(signal);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

serverProcess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

await waitForMatchmake();

async function waitForMatchmake() {
  const readyUrl = "http://localhost:2567/matchmake/joinOrCreate/duel";

  for (let attempt = 0; attempt < 60; attempt += 1) {
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
      // Server may still be starting up.
    }

    await wait(250);
  }

  throw new Error("Colyseus matchmaking endpoint did not become ready in time.");
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
