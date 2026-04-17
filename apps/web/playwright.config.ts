import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const e2eServerPort = 2569;

export default defineConfig({
  fullyParallel: false,
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    trace: "retain-on-failure",
    viewport: {
      height: 900,
      width: 1440
    }
  },
  webServer: [
    {
      command: `PORT=${e2eServerPort} npm run start:e2e --workspace @snowbattle/server`,
      cwd: repoRoot,
      reuseExistingServer: true,
      timeout: 120_000,
      url: `http://localhost:${e2eServerPort}/health`
    },
    {
      command: "npm run preview",
      cwd: webDir,
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://localhost:4173"
    }
  ]
});
