import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
    viewport: {
      height: 900,
      width: 1440
    }
  },
  webServer: [
    {
      command: "npm run start --workspace @snowbattle/server",
      cwd: repoRoot,
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:2567/health"
    },
    {
      command: "npm run preview",
      cwd: webDir,
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:4173"
    }
  ]
});
