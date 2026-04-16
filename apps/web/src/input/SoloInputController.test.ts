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
});

function createController(providerOverride?: { send: ReturnType<typeof vi.fn> }) {
  const provider = providerOverride ?? { send: vi.fn() };
  const controller = new SoloInputController(
    {
      addEventListener() {},
      removeEventListener() {}
    } as unknown as HTMLElement,
    {
      screenPointToWorld: () => null
    } as never,
    provider as never
  ) as unknown as {
    handleKeyDown: (event: KeyboardEvent) => void;
    handleKeyUp: (event: KeyboardEvent) => void;
    pressedKeys: Set<string>;
  };

  return controller;
}
