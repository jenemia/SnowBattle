import {
  SERVER_TICK_RATE,
  type BuildType,
  type GameSessionProvider,
  type SessionCommand,
  type SlotId
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
  private lastSentInputSignature: string | null = null;
  private nextInputSeq = 1;
  private pointerActive = false;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private readonly pressedKeys = new Set<string>();

  constructor(
    private readonly target: HTMLElement,
    private readonly scene: SoloArenaScene,
    private readonly provider: GameSessionProvider,
    private readonly onCommand?: (command: SessionCommand) => void
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

    if (!this.connected || this.getSelectedBuild() === null) {
      return;
    }

    this.dispatchCommand({
      inputSeq: this.claimInputSeq(),
      type: "build:cancel"
    });
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const movementKey = normalizeMovementKey(event.key, event.code);

    if (movementKey) {
      event.preventDefault();
      this.pressedKeys.add(movementKey);
      this.sendInputUpdate(true);
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
      this.dispatchCommand({
        inputSeq: this.claimInputSeq(),
        payload: { buildType },
        type: "build:select"
      });
      return;
    }

    if (event.key === "Escape") {
      if (event.repeat) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      this.dispatchCommand({
        inputSeq: this.claimInputSeq(),
        type: "build:cancel"
      });
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    const movementKey = normalizeMovementKey(event.key, event.code);

    if (!movementKey) {
      return;
    }

    event.preventDefault();
    this.pressedKeys.delete(movementKey);
    this.sendInputUpdate(true);
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.pointerActive = true;
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    this.sendInputUpdate(true);
    this.dispatchCommand({
      inputSeq: this.claimInputSeq(),
      type: "action:primary"
    });
  };

  private readonly handlePointerLeave = () => {
    if (!this.pointerActive) {
      return;
    }

    this.pointerActive = false;
    this.sendInputUpdate(true);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    this.pointerActive = true;
    this.pointerClientX = event.clientX;
    this.pointerClientY = event.clientY;
    this.sendInputUpdate(true);
  };

  private sendInputUpdate(force = false) {
    if (!this.connected) {
      return;
    }

    const movement = getNormalizedMovement(this.pressedKeys);
    const orientedMovement = orientMovementForSlot(movement, this.getLocalSlot());
    const worldPoint = this.pointerActive
      ? this.scene.screenPointToWorld(this.pointerClientX, this.pointerClientY)
      : null;
    const nextPayload = {
      aimX: worldPoint?.x ?? 0,
      aimY: worldPoint?.z ?? 0,
      moveX: orientedMovement.x,
      moveY: orientedMovement.y,
      pointerActive: worldPoint !== null
    };
    const nextSignature = JSON.stringify(nextPayload);
    const shouldKeepAlive =
      nextPayload.pointerActive ||
      Math.abs(nextPayload.moveX) > 1e-6 ||
      Math.abs(nextPayload.moveY) > 1e-6;

    if (!force && !shouldKeepAlive && this.lastSentInputSignature === nextSignature) {
      return;
    }

    if (force && this.lastSentInputSignature === nextSignature && !shouldKeepAlive) {
      return;
    }

    const command: SessionCommand = {
      inputSeq: this.claimInputSeq(),
      payload: nextPayload,
      sentAtClientTime: Date.now(),
      type: "input:update"
    };

    this.lastSentInputSignature = nextSignature;
    this.dispatchCommand(command);
  }

  private dispatchCommand(command: SessionCommand) {
    this.onCommand?.(command);
    this.provider.send(command);
  }

  private claimInputSeq() {
    const nextSeq = this.nextInputSeq;
    this.nextInputSeq += 1;
    return nextSeq;
  }

  private getLocalSlot(): SlotId {
    return (
      this.provider.getSessionMeta()?.localSlot ??
      this.provider.getLatestSnapshot()?.localPlayer.slot ??
      "A"
    );
  }

  private getSelectedBuild() {
    return this.provider.getLatestSnapshot()?.localPlayer.selectedBuild ?? null;
  }
}

function orientMovementForSlot(
  movement: { x: number; y: number },
  localSlot: SlotId
) {
  if (localSlot !== "B") {
    return movement;
  }

  return {
    x: -movement.x,
    y: -movement.y
  };
}
