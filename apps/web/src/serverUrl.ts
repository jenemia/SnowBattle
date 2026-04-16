const LOCAL_SERVER_URL = "ws://localhost:2567";
const PRODUCTION_SERVER_URL = "wss://snowbattle.fly.dev";

export interface ServerUrlResolution {
  isConfigured: boolean;
  reason: "explicit" | "local_default" | "production_missing" | "host_missing";
  serverUrl: string;
  statusDetail: string;
  statusMessage: string;
}

export interface ResolveServerUrlOptions {
  explicitUrl?: string;
  hostname: string;
  isProduction: boolean;
}

export function resolveServerUrl(options: ResolveServerUrlOptions): ServerUrlResolution {
  const explicitUrl = options.explicitUrl?.trim();

  if (explicitUrl) {
    return {
      isConfigured: true,
      reason: "explicit",
      serverUrl: explicitUrl,
      statusDetail: `configured via VITE_SERVER_URL: ${explicitUrl}`,
      statusMessage: "Configured backend endpoint detected."
    };
  }

  if (isLocalHost(options.hostname)) {
    return {
      isConfigured: true,
      reason: "local_default",
      serverUrl: LOCAL_SERVER_URL,
      statusDetail: `local fallback: ${LOCAL_SERVER_URL}`,
      statusMessage: "Using local SnowBattle server."
    };
  }

  if (options.isProduction) {
    return {
      isConfigured: false,
      reason: "production_missing",
      serverUrl: "",
      statusDetail: `missing VITE_SERVER_URL, expected ${PRODUCTION_SERVER_URL}`,
      statusMessage: "Production backend not configured."
    };
  }

  return {
    isConfigured: false,
    reason: "host_missing",
    serverUrl: "",
    statusDetail: "host is not localhost and VITE_SERVER_URL is empty",
    statusMessage: "Backend endpoint not configured for this host."
  };
}

export function getProductionServerUrl() {
  return PRODUCTION_SERVER_URL;
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
