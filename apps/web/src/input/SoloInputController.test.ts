import { describe, expect, it, vi } from "vitest";

import { SoloInputController } from "./SoloInputController";

describe("SoloInputController", () => {
  it("uses keyboard code bindings for wasd movement keys", () => {
    const controller = createController();
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
    const provider = { send: vi.fn() };
    const controller = createController(provider);

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
    const provider = { send: vi.fn() };
    const controller = createController(provider);

    controller.handleKeyDown({
      code: "Digit1",
      key: "1",
      preventDefault: vi.fn(),
      repeat: true
    } as unknown as KeyboardEvent);

    expect(provider.send).not.toHaveBeenCalled();
  });

  it("flushes the latest cursor position before primary actions", () => {
    const provider = { send: vi.fn() };
    const controller = createController(provider, {
      screenPointToWorld: () => ({ x: 4, z: -2 })
    });

    controller.handlePointerDown({
      button: 0,
      clientX: 240,
      clientY: 180,
      preventDefault: vi.fn()
    } as unknown as PointerEvent);

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
});

function createController(
  providerOverride?: { send: ReturnType<typeof vi.fn> },
  sceneOverride?: { screenPointToWorld: () => { x: number; z: number } | null }
) {
  const provider = providerOverride ?? { send: vi.fn() };
  const controller = new SoloInputController(
    {
      addEventListener() {},
      removeEventListener() {}
    } as unknown as HTMLElement,
    (sceneOverride ?? {
      screenPointToWorld: () => null
    }) as never,
    provider as never
  ) as unknown as {
    handleKeyDown: (event: KeyboardEvent) => void;
    handleKeyUp: (event: KeyboardEvent) => void;
    handlePointerDown: (event: PointerEvent) => void;
    pressedKeys: Set<string>;
  };

  return controller;
}
