import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SERVER_TICK_RATE,
  type SessionSnapshot
} from "@snowbattle/shared";

import { SoloInputController } from "./SoloInputController";

describe("SoloInputController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", createMockWindow());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses keyboard code bindings for wasd movement keys", () => {
    const { controller } = createController();
    const preventDefault = vi.fn();

    controller.handleKeyDown({
      code: "KeyW",
      key: "ㅈ",
      preventDefault
    } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect([...controller.pressedKeys]).toContain("w");

    controller.handleKeyUp({
      code: "KeyW",
      key: "ㅈ",
      preventDefault
    } as unknown as KeyboardEvent);

    expect(controller.pressedKeys.size).toBe(0);
  });

  it("maps numpad digits to build selections", () => {
    const { controller, provider } = createController();

    controller.handleKeyDown({
      code: "Numpad2",
      key: "2",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent);

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "build:select",
        payload: { buildType: "snowman_turret" }
      })
    );
  });

  it("ignores repeated build hotkeys", () => {
    const { controller, provider } = createController();

    controller.handleKeyDown({
      code: "Digit1",
      key: "1",
      preventDefault: vi.fn(),
      repeat: true
    } as unknown as KeyboardEvent);

    expect(provider.send).not.toHaveBeenCalled();
  });

  it("flushes the latest cursor position before primary actions", () => {
    const { controller, provider } = createController({
      screenPointToWorld: () => ({ x: 4, z: -2 })
    });

    controller.connect();
    controller.handlePointerDown({
      button: 0,
      clientX: 240,
      clientY: 180,
      preventDefault: vi.fn()
    } as unknown as PointerEvent);
    controller.disconnect();

    expect(provider.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "input:update",
        payload: {
          aimX: 4,
          aimY: -2,
          moveX: 0,
          moveY: 0,
          pointerActive: true
        }
      })
    );
    expect(provider.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "action:primary" })
    );
  });

  it("keeps sending held movement input at the server tick rate", () => {
    const { controller, provider } = createController();

    controller.connect();
    controller.handleKeyDown({
      code: "ArrowUp",
      key: "ArrowUp",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent);
    vi.advanceTimersByTime(2_000);
    controller.disconnect();

    expect(getInputUpdates(provider.send)).toHaveLength(1 + 2 * SERVER_TICK_RATE);
  });

  it("keeps recomputing aim while the pointer stays active", () => {
    let worldPoint = { x: 4, z: 8 };
    const { controller, provider, scene } = createController({
      screenPointToWorld: () => worldPoint
    });

    controller.connect();
    controller.handlePointerMove({
      clientX: 120,
      clientY: 180
    } as unknown as PointerEvent);

    vi.advanceTimersByTime(1000 / SERVER_TICK_RATE);

    worldPoint = { x: 9, z: -3 };

    vi.advanceTimersByTime(1000 / SERVER_TICK_RATE);
    controller.disconnect();

    const updates = getInputUpdates(provider.send);

    expect(updates).toHaveLength(3);
    expect(updates[0].payload).toMatchObject({
      aimX: 4,
      aimY: 8,
      pointerActive: true
    });
    expect(updates[2].payload).toMatchObject({
      aimX: 9,
      aimY: -3,
      pointerActive: true
    });
    expect(scene.screenPointToWorld).toHaveBeenCalledTimes(3);
  });

  it("mirrors movement input for slot B so screen-relative controls stay fixed", () => {
    const snapshot = createSnapshot("B");
    const { controller, provider } = createController(undefined, snapshot);

    controller.connect();
    controller.handleKeyDown({
      code: "ArrowUp",
      key: "ArrowUp",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent);
    controller.handleKeyDown({
      code: "ArrowRight",
      key: "ArrowRight",
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent);

    vi.advanceTimersByTime(1000 / SERVER_TICK_RATE);
    controller.disconnect();

    const updates = getInputUpdates(provider.send);
    const update = updates.at(-1);
    expect(update?.payload.moveX).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(update?.payload.moveY).toBeCloseTo(Math.SQRT1_2, 5);
  });
});

type ControllerHarness = ReturnType<typeof createController>;

function createController(
  sceneOverride?: { screenPointToWorld: () => { x: number; z: number } | null },
  snapshotOverride: SessionSnapshot | null = null
) {
  const provider = {
    getLatestStateEnvelope: vi.fn(() => null),
    getLatestSnapshot: vi.fn(() => snapshotOverride),
    getSessionMeta: vi.fn(() => {
      if (!snapshotOverride) {
        return null;
      }

      return {
        guestName: "You",
        localSlot: snapshotOverride.localPlayer.slot,
        opponentGuestName: "Opponent",
        roomId: "room-1"
      };
    }),
    send: vi.fn()
  };
  const scene = {
    screenPointToWorld: vi.fn(
      sceneOverride?.screenPointToWorld ?? (() => null)
    )
  };
  const controller = new SoloInputController(
    {
      addEventListener() {},
      removeEventListener() {}
    } as unknown as HTMLElement,
    scene as never,
    provider as never
  ) as unknown as {
    connect: () => void;
    disconnect: () => void;
    handleKeyDown: (event: KeyboardEvent) => void;
    handleKeyUp: (event: KeyboardEvent) => void;
    handlePointerDown: (event: PointerEvent) => void;
    handlePointerMove: (event: PointerEvent) => void;
    pressedKeys: Set<string>;
  };

  return {
    controller,
    provider,
    scene
  };
}

function createMockWindow() {
  return {
    addEventListener() {},
    clearInterval,
    removeEventListener() {},
    setInterval
  } as unknown as Window & typeof globalThis;
}

function getInputUpdates(send: ControllerHarness["provider"]["send"]) {
  return send.mock.calls
    .map(([command]) => command)
    .filter((command) => command.type === "input:update");
}

function createSnapshot(
  slot: SessionSnapshot["localPlayer"]["slot"]
): SessionSnapshot {
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
      facingAngle: 0,
      guestName: "You",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot,
      snowLoad: 0,
      x: 0,
      z: slot === "B" ? -10 : 10
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
      guestName: "Opponent",
      hp: 100,
      packedSnow: 100,
      ready: true,
      selectedBuild: null,
      slowMultiplier: 1,
      slot: slot === "A" ? "B" : "A",
      snowLoad: 0,
      x: 0,
      z: slot === "B" ? 10 : -10
    },
    projectiles: [],
    structures: []
  };
}
