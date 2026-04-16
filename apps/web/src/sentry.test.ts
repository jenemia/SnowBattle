import { describe, expect, it } from "vitest";

import { resolveSentryConfig } from "./sentry";

describe("resolveSentryConfig", () => {
  it("disables sentry when dsn is missing", () => {
    expect(
      resolveSentryConfig({
        isProduction: true
      })
    ).toMatchObject({
      dsn: "",
      enabled: false,
      environment: "production",
      tracesSampleRate: 0.1
    });
  });

  it("enables sentry when dsn exists", () => {
    expect(
      resolveSentryConfig({
        dsn: "https://public@example.ingest.sentry.io/123",
        environment: "staging",
        isProduction: false,
        tracesSampleRate: "0.25"
      })
    ).toMatchObject({
      enabled: true,
      environment: "staging",
      tracesSampleRate: 0.25
    });
  });

  it("clamps traces sample rate into the supported range", () => {
    expect(
      resolveSentryConfig({
        dsn: "https://public@example.ingest.sentry.io/123",
        isProduction: true,
        tracesSampleRate: "4"
      }).tracesSampleRate
    ).toBe(1);
  });

  it("defaults development traces to zero", () => {
    expect(
      resolveSentryConfig({
        dsn: "https://public@example.ingest.sentry.io/123",
        isProduction: false
      }).tracesSampleRate
    ).toBe(0);
  });
});
