import * as Sentry from "@sentry/browser";

const DEFAULT_PRODUCTION_TRACES_SAMPLE_RATE = 0.1;

export interface SentryConfigInput {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: string;
  isProduction: boolean;
}

export interface SentryRuntimeConfig {
  dsn: string;
  enabled: boolean;
  environment: string;
  tracesSampleRate: number;
}

export function resolveSentryConfig(input: SentryConfigInput): SentryRuntimeConfig {
  const dsn = input.dsn?.trim() ?? "";
  const tracesSampleRate = parseTracesSampleRate(input.tracesSampleRate, input.isProduction);

  return {
    dsn,
    enabled: dsn.length > 0,
    environment:
      input.environment?.trim() ||
      (input.isProduction ? "production" : "development"),
    tracesSampleRate
  };
}

export function initSentry() {
  const config = resolveSentryConfig({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    isProduction: import.meta.env.PROD,
    tracesSampleRate: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
  });

  if (!config.enabled) {
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    integrations:
      config.tracesSampleRate > 0
        ? [Sentry.browserTracingIntegration()]
        : [],
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/snowbattle\.fly\.dev/,
      /^wss:\/\/snowbattle\.fly\.dev/
    ],
    tracesSampleRate: config.tracesSampleRate
  });
}

function parseTracesSampleRate(
  value: string | undefined,
  isProduction: boolean
) {
  if (!value) {
    return isProduction ? DEFAULT_PRODUCTION_TRACES_SAMPLE_RATE : 0;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return isProduction ? DEFAULT_PRODUCTION_TRACES_SAMPLE_RATE : 0;
  }

  return Math.min(1, Math.max(0, parsed));
}
