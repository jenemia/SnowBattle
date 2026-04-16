import type { BuildType, GameSessionProvider } from "@snowbattle/shared";

import { getNormalizedMovement, normalizeMovementKey } from "../game/soloMath";
import type { SoloArenaScene } from "../game/SoloArenaScene";

const BUILD_KEY_TO_TYPE: Record<string, BuildType> = {
  "1": "wall",
  "2": "snowman_turret",
  "3": "heater_beacon"
};

export class SoloInputController {
  private animationFrame = 0;
  private connected = false;
  private pointerActive = false;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private readonly pressedKeys = new Set<string>();

  constructor(
    private readonly target: HTMLElement,
    private readonly scene: SoloArenaScene,
    private readonly provider: GameSessionProvider
  ) {}

  connect() {
    if (this.connected) {
      return;
    }

    this.connected = true;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.target.addEventListener("contextmenu", this.handleContextMenu);
    this.target.addEventListener("pointerdown", this.handlePointerDown);
    this.target.addEventListener("pointerleave", this.handlePointerLeave);
    this.target.addEventListener("pointermove", this.handlePointerMove);
    this.tick();
  }

  disconnect() {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("contextmenu", this.handleContextMenu);
    this.target.removeEventListener("pointerdown", this.handlePointerDown);
    this.target.removeEventListener("pointerleave", this.handlePointerLeave);
    this.target.removeEventListener("pointermove", this.handlePointerMove);
    window.cancelAnimationFrame(this.animationFrame);
  }

  private tick = () => {
    if (!this.connected) {
      return;
    }

    const movement = getNormalizedMovement(this.pressedKeys);
    const worldPoint = this.pointerActive
      ? this.scene.screenPointToWorld(this.pointerClientX, this.pointerClientY)
      : null;

    this.provider.send({
      type: "input:update",
      payload: {
        aimX: worldPoint?.x ?? 0,
        aimY: worldPoint?.z ?? 0,
        moveX: movement.x,
        moveY: movement.y,
        pointerActive: worldPoint !== null
      }
    });

    this.animationFrame = window.requestAnimationFrame(this.tick);
  };

  private readonly handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const movementKey = normalizeMovementKey(event.key, event.code);

    if (movementKey) {
      event.preventDefault();
      this.pressedKeys.add(movementKey);
      return;
    }

    const digitKey =
      event.code === "Numpad1" ? "1" :
      event.code === "Numpad2" ? "2" :
      event.code === "Numpad3" ? "3" :
      event.key;
    const buildType = BUILD_KEY_TO_TYPE[digitKey];
    if (buildType) {
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      this.provider.send({
        type: "build:select",
        payload: { buildType }
      });
      return;
    }

    if (event.key === "Escape") {
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      this.provider.send({ type: "build:cancel" });
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    const movementKey = normalizeMovementKey(event.key, event.code);

    if (!movementKey) {
      return;
    }

    event.preventDefault();
    this.pressedKeys.delete(movementKey);
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.pointerActive = true;
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    this.provider.send({ type: "action:primary" });
  };

  private readonly handlePointerLeave = () => {
    this.pointerActive = false;
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    this.pointerActive = true;
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
  };
}
