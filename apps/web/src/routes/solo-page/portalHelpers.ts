import { PLAYER_SPEED } from "@snowbattle/shared";

export interface PortalContext {
  color: string | null;
  isPortalArrival: boolean;
  ref: string | null;
  speed: number | null;
  username: string | null;
}

export interface PortalPosition {
  x: number;
  z: number;
}

export const EXIT_PORTAL_POSITION: PortalPosition = {
  x: 15.5,
  z: 15.5
};

export const RETURN_PORTAL_POSITION: PortalPosition = {
  x: -15.5,
  z: 15.5
};

export const PORTAL_TRIGGER_RADIUS = 1.8;
export const VIBE_JAM_PORTAL_URL = "https://vibej.am/portal/2026";

const PORTAL_QUERY_KEYS = ["portal", "ref", "username", "color", "speed"] as const;

export function createPortalContextFromUrl(href: string): PortalContext {
  const url = new URL(href);
  const portalValue = url.searchParams.get("portal");
  const speedValue = url.searchParams.get("speed");

  return {
    color: url.searchParams.get("color"),
    isPortalArrival: portalValue === "true" || portalValue === "1",
    ref: url.searchParams.get("ref"),
    speed: speedValue === null ? null : Number.parseFloat(speedValue),
    username: url.searchParams.get("username")
  };
}

export function getCanonicalGameUrl(href: string) {
  const url = new URL(href);

  for (const key of PORTAL_QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  return url.toString();
}

export function buildVibeJamPortalUrl(options: {
  color?: string | null;
  currentGameUrl: string;
  speed?: number | null;
  username?: string | null;
}) {
  const url = new URL(VIBE_JAM_PORTAL_URL);
  applyPortalParams(url, {
    color: options.color ?? null,
    ref: options.currentGameUrl,
    speed: options.speed ?? PLAYER_SPEED,
    username: options.username ?? null
  });
  return url.toString();
}

export function buildReturnPortalUrl(options: {
  color?: string | null;
  currentGameUrl: string;
  ref: string;
  speed?: number | null;
  username?: string | null;
}) {
  const url = new URL(options.ref);
  url.searchParams.set("portal", "true");
  applyPortalParams(url, {
    color: options.color ?? null,
    ref: options.currentGameUrl,
    speed: options.speed ?? PLAYER_SPEED,
    username: options.username ?? null
  });
  return url.toString();
}

export function isPlayerInsidePortal(
  player: { x: number; z: number },
  portal: PortalPosition
) {
  return Math.hypot(player.x - portal.x, player.z - portal.z) <= PORTAL_TRIGGER_RADIUS;
}

function applyPortalParams(
  url: URL,
  params: {
    color: string | null;
    ref: string;
    speed: number | null;
    username: string | null;
  }
) {
  url.searchParams.set("ref", params.ref);

  if (params.username) {
    url.searchParams.set("username", params.username);
  } else {
    url.searchParams.delete("username");
  }

  if (params.color) {
    url.searchParams.set("color", params.color);
  } else {
    url.searchParams.delete("color");
  }

  if (params.speed !== null && Number.isFinite(params.speed)) {
    url.searchParams.set("speed", params.speed.toFixed(2));
  } else {
    url.searchParams.delete("speed");
  }
}
