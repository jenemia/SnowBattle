import {
  SERVER_TICK_RATE,
  type SessionSnapshot,
  type BuildType,
  type GameSessionProvider
} from "@snowbattle/shared";

import { getNormalizedMovement, normalizeMovementKey } from "../game/soloMath";
import type { SoloArenaScene } from "../game/SoloArenaScene";

const BUILD_KEY_TO_TYPE: Record<string, BuildType> = {
  "1": "wall",
  "2": "snowman_turret",
  "3": "heater_beacon"
};

export class SoloInputController {
  private connected = false;
  private flushInterval: number | null = null;
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
    this.flushInterval = window.setInterval(() => {
      this.sendInputUpdate();
    }, 1000 / SERVER_TICK_RATE);
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
    if (this.flushInterval !== null) {
      window.clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

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
    this.sendInputUpdate();
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

  private sendInputUpdate() {
    if (!this.connected) {
      return;
    }

    const movement = getNormalizedMovement(this.pressedKeys);
    const orientedMovement = orientMovementForSnapshot(
      movement,
      this.provider.getLatestSnapshot()
    );
    const worldPoint = this.pointerActive
      ? this.scene.screenPointToWorld(this.pointerClientX, this.pointerClientY)
      : null;

    this.provider.send({
      type: "input:update",
      payload: {
        aimX: worldPoint?.x ?? 0,
        aimY: worldPoint?.z ?? 0,
        moveX: orientedMovement.x,
        moveY: orientedMovement.y,
        pointerActive: worldPoint !== null
      }
    });
  }
}

function orientMovementForSnapshot(
  movement: { x: number; y: number },
  snapshot: SessionSnapshot | null
) {
  if (snapshot?.localPlayer.slot !== "B") {
    return movement;
  }

  return {
    x: -movement.x,
    y: -movement.y
  };
}
