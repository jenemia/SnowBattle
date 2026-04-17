import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SERVER_TICK_RATE } from "@snowbattle/shared";

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

    expect(provider.send).toHaveBeenCalledWith({
      type: "build:select",
      payload: { buildType: "snowman_turret" }
    });
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

    expect(provider.send).toHaveBeenNthCalledWith(1, {
      type: "input:update",
      payload: {
        aimX: 4,
        aimY: -2,
        moveX: 0,
        moveY: 0,
        pointerActive: true
      }
    });
    expect(provider.send).toHaveBeenNthCalledWith(2, { type: "action:primary" });
  });

  it("flushes input updates at the server tick rate", () => {
    const { controller, provider } = createController();

    controller.connect();
    vi.advanceTimersByTime(2_000);
    controller.disconnect();

    expect(getInputUpdates(provider.send)).toHaveLength(2 * SERVER_TICK_RATE);
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

    expect(updates).toHaveLength(2);
    expect(updates[0].payload).toMatchObject({
      aimX: 4,
      aimY: 8,
      pointerActive: true
    });
    expect(updates[1].payload).toMatchObject({
      aimX: 9,
      aimY: -3,
      pointerActive: true
    });
    expect(scene.screenPointToWorld).toHaveBeenCalledTimes(2);
  });
});

type ControllerHarness = ReturnType<typeof createController>;

function createController(
  sceneOverride?: { screenPointToWorld: () => { x: number; z: number } | null }
) {
  const provider = { send: vi.fn() };
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
