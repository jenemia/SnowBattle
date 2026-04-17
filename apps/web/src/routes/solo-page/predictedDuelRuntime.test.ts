import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthoritativeStateEnvelope,
  GameSessionProvider,
  SessionMeta,
  SessionSnapshot
} from "@snowbattle/shared";

import { PredictedDuelRuntime } from "./predictedDuelRuntime";

describe("PredictedDuelRuntime", () => {
  let animationFrame: FrameRequestCallback | null = null;
  let now = 0;

  beforeEach(() => {
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("window", {
      cancelAnimationFrame() {},
      requestAnimationFrame(callback: FrameRequestCallback) {
        animationFrame = callback;
        return 1;
      }
    } as unknown as Window & typeof globalThis);
  });

  afterEach(() => {
    animationFrame = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows local movement immediately and drops pending input once it is acked", () => {
    const meta: SessionMeta = {
      guestName: "Alpha",
      localSlot: "A",
      opponentGuestName: "Beta",
      roomId: "room-1"
    };
    let latestSnapshot = createSnapshot();
    let latestEnvelope = createEnvelope(latestSnapshot, 0, 1);
    const provider = createProvider(meta, () => latestSnapshot, () => latestEnvelope);
    const runtime = new PredictedDuelRuntime(provider);
    const frames: SessionSnapshot[] = [];

    runtime.subscribe((frame) => {
      frames.push(frame.snapshot);
    });
    runtime.start();
    runtime.captureCommand({
      inputSeq: 1,
      payload: {
        aimX: 0,
        aimY: 0,
        moveX: 0,
        moveY: -1,
        pointerActive: false
      },
      sentAtClientTime: 1,
      type: "input:update"
    });

    now = 20;
    animationFrame?.(20);

    expect(frames.at(-1)?.localPlayer.z).toBeLessThan(10);

    latestEnvelope = createEnvelope(createSnapshot(), 1, 2);
    latestSnapshot = latestEnvelope.snapshot;
    runtime.receiveAuthoritativeState(latestEnvelope);

    now = 40;
    animationFrame?.(40);

    expect(frames.at(-1)?.localPlayer.z).toBeCloseTo(10, 2);

    runtime.stop();
  });
});

function createProvider(
  meta: SessionMeta,
  getLatestSnapshot: () => SessionSnapshot,
  getLatestStateEnvelope: () => AuthoritativeStateEnvelope
): GameSessionProvider {
  return {
    connect() {},
    disconnect() {},
    getLatestSnapshot,
    getLatestStateEnvelope,
    getSessionMeta() {
      return meta;
    },
    send() {},
    subscribe() {
      return () => {};
    },
    subscribeEvent() {
      return () => {};
    },
    subscribeStateEnvelope() {
      return () => {};
    }
  };
}

function createEnvelope(
  snapshot: SessionSnapshot,
  ackInputSeq: number,
  serverTick: number
): AuthoritativeStateEnvelope {
  return {
    ackInputSeq,
    roomId: "room-1",
    serverTick,
    snapshot
  };
}

function createSnapshot(): SessionSnapshot {
  return {
    hud: {
      activeBonfire: false,
      buildPreviewValid: true,
      cursorX: 0,
      cursorZ: 0,
      pointerActive: false,
      result: null
    },
    localPlayer: {
      buildCooldownRemaining: 0,
      connected: true,
      facingAngle: Math.PI,
      guestName: "Alpha",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: "A",
      snowLoad: 0,
      x: 0,
      z: 10
    },
    match: {
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 },
      countdownRemainingMs: 0,
      lifecycle: "in_match",
      phase: "standard",
      timeRemainingMs: 180_000,
      whiteoutRadius: 22
    },
    opponentPlayer: {
      buildCooldownRemaining: 0,
      connected: true,
      facingAngle: 0,
      guestName: "Beta",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: "B",
      snowLoad: 0,
      x: 0,
      z: -10
    },
    projectiles: [],
    structures: []
  };
}
