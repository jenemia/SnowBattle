import { describe, expect, it } from "vitest";

import { getProductionServerUrl, resolveServerUrl } from "./serverUrl";

describe("resolveServerUrl", () => {
  it("prefers an explicit env value", () => {
    expect(
      resolveServerUrl({
        explicitUrl: "wss://custom.example.com",
        hostname: "jenemia.github.io",
        isProduction: true
      })
    ).toMatchObject({
      isConfigured: true,
      reason: "explicit",
      serverUrl: "wss://custom.example.com"
    });
  });

  it("falls back to localhost during local development", () => {
    expect(
      resolveServerUrl({
        explicitUrl: "",
        hostname: "localhost",
        isProduction: false
      })
    ).toMatchObject({
      isConfigured: true,
      reason: "local_default",
      serverUrl: "ws://localhost:2567"
    });
  });

  it("reports a missing production backend when env is empty", () => {
    expect(
      resolveServerUrl({
        hostname: "jenemia.github.io",
        isProduction: true
      })
    ).toMatchObject({
      isConfigured: false,
      reason: "production_missing",
      serverUrl: "",
      statusDetail: `missing VITE_SERVER_URL, expected ${getProductionServerUrl()}`
    });
  });

  it("reports a missing host mapping outside production", () => {
    expect(
      resolveServerUrl({
        hostname: "staging.example.com",
        isProduction: false
      })
    ).toMatchObject({
      isConfigured: false,
      reason: "host_missing",
      serverUrl: ""
    });
  });
});
