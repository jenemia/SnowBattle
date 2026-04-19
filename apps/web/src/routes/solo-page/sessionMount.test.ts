import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MATCH_RULES,
  type GameSessionProvider,
  type SessionSnapshot
} from "@snowbattle/shared";

const mockState = vi.hoisted(() => ({
  input: null as {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    provider: GameSessionProvider;
    scene: object;
    target: HTMLElement;
  } | null,
  scene: null as {
    dispose: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    screenPointToWorld: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  } | null
}));

vi.mock("../../game/SoloArenaScene", () => {
  return {
    SoloArenaScene: vi.fn().mockImplementation(() => {
      mockState.scene = {
        dispose: vi.fn(),
        render: vi.fn(),
        screenPointToWorld: vi.fn(() => null),
        start: vi.fn()
      };

      return mockState.scene;
    })
  };
});

vi.mock("../../input/SoloInputController", () => {
  return {
    SoloInputController: vi.fn().mockImplementation(
      (target: HTMLElement, scene: object, provider: GameSessionProvider) => {
        mockState.input = {
          connect: vi.fn(),
          disconnect: vi.fn(),
          provider,
          scene,
          target
        };

        return mockState.input;
      }
    )
  };
});

import { SoloArenaScene } from "../../game/SoloArenaScene";
import { mountGameSession } from "./sessionMount";

describe("mountGameSession", () => {
  beforeEach(() => {
    mockState.input = null;
    mockState.scene = null;
  });

  it("pipes provider snapshots through the shared scene and callback", () => {
    const provider = createProvider();
    const onSnapshot = vi.fn();
    const viewport = { innerHTML: "occupied" } as unknown as HTMLElement;

    const teardown = mountGameSession({
      autoConnect: false,
      onSnapshot,
      provider,
      viewport
    });

    expect(viewport.innerHTML).toBe("");
    expect(mockState.scene?.start).toHaveBeenCalledOnce();
    expect(mockState.input?.connect).toHaveBeenCalledOnce();
    expect(mockState.input?.provider).toBe(provider);

    provider.emit(createSnapshot());

    expect(mockState.scene?.render).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledTimes(1);

    teardown();

    expect(mockState.input?.disconnect).toHaveBeenCalledOnce();
    expect(mockState.scene?.dispose).toHaveBeenCalledOnce();
    expect(provider.disconnect).toHaveBeenCalledOnce();
    expect(provider.unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports scene construction failures without wiring input listeners", () => {
    const provider = createProvider();
    const onSnapshot = vi.fn();
    const onSceneError = vi.fn();
    const viewport = { innerHTML: "occupied" } as unknown as HTMLElement;

    const SoloArenaSceneMock = vi.mocked(SoloArenaScene);
    SoloArenaSceneMock.mockImplementationOnce(() => {
      throw new Error("Error creating WebGL context.");
    });

    const teardown = mountGameSession({
      autoConnect: false,
      onSceneError,
      onSnapshot,
      provider,
      viewport
    });

    expect(viewport.innerHTML).toBe("");
    expect(onSceneError).toHaveBeenCalledTimes(1);
    expect(mockState.scene).toBeNull();
    expect(mockState.input).toBeNull();

    teardown();

    expect(provider.disconnect).toHaveBeenCalledOnce();
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});

function createProvider() {
  let listener: ((snapshot: SessionSnapshot) => void) | null = null;
  const disconnect = vi.fn();
  const unsubscribe = vi.fn();

  return {
    connect: vi.fn(),
    disconnect,
    emit(snapshot: SessionSnapshot) {
      listener?.(snapshot);
    },
    getLatestStateEnvelope() {
      return null;
    },
    getLatestSnapshot() {
      return null;
    },
    getSessionMeta() {
      return null;
    },
    send: vi.fn(),
    subscribe(callback: (snapshot: SessionSnapshot) => void) {
      listener = callback;

      return () => {
        listener = null;
        unsubscribe();
      };
    },
    subscribeStateEnvelope() {
      return () => {};
    },
    subscribeEvent() {
      return () => {};
    },
    unsubscribe
  };
}

function createSnapshot(): SessionSnapshot {
  return {
    hud: {
      activeBonfire: false,
      buildPreviewValid: false,
      cursorX: 0,
      cursorZ: 0,
      pointerActive: false,
      result: null
    },
    localPlayer: {
      buildCooldownRemaining: 0,
      connected: true,
      facingAngle: 0,
      guestName: "Alpha",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: "A",
      snowLoad: 0,
      x: 1,
      z: 2
    },
    match: {
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 },
      countdownRemainingMs: 0,
      lifecycle: "in_match",
      phase: "standard",
      timeRemainingMs: DEFAULT_MATCH_RULES.matchDurationMs,
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
      x: -1,
      z: -2
    },
    projectiles: [],
    structures: []
  };
}
