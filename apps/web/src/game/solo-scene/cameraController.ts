import * as THREE from "three";

import { ARENA_HALF_EXTENT, type SessionSnapshot } from "@snowbattle/shared";

const CAMERA_HEIGHT = 34;
const CAMERA_LERP_SPEED = 4.4;
const CAMERA_OFFSET_Z = 22;

export class SoloSceneCameraController {
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 250);
  private readonly idleCameraPosition = new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_OFFSET_Z);
  private readonly idleLookTarget = new THREE.Vector3(0, 1.5, 0.4);
  private readonly raycaster = new THREE.Raycaster();
  private readonly screenNdc = new THREE.Vector2();
  private readonly scratchCameraPosition = new THREE.Vector3();
  private readonly scratchLookTarget = new THREE.Vector3();

  constructor() {
    this.camera.position.copy(this.idleCameraPosition);
    this.camera.lookAt(this.idleLookTarget);
  }

  update(snapshot: SessionSnapshot | null, delta: number) {
    if (snapshot) {
      const focusX =
        snapshot.localPlayer.x +
        (snapshot.hud.cursorX - snapshot.localPlayer.x) * 0.32;
      const focusZ =
        snapshot.localPlayer.z +
        (snapshot.hud.cursorZ - snapshot.localPlayer.z) * 0.32;

      this.scratchCameraPosition.set(
        snapshot.localPlayer.x,
        CAMERA_HEIGHT,
        snapshot.localPlayer.z + CAMERA_OFFSET_Z
      );
      this.scratchLookTarget.set(focusX, 1.5, focusZ + 0.4);
    } else {
      this.scratchCameraPosition.copy(this.idleCameraPosition);
      this.scratchLookTarget.copy(this.idleLookTarget);
    }

    this.camera.position.lerp(
      this.scratchCameraPosition,
      1 - Math.exp(-CAMERA_LERP_SPEED * delta)
    );
    this.camera.lookAt(this.scratchLookTarget);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  screenPointToWorld(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ) {
    const bounds = canvas.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    this.screenNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    this.screenNdc.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.screenNdc, this.camera);

    const { direction, origin } = this.raycaster.ray;
    if (Math.abs(direction.y) < 1e-6) {
      return null;
    }

    const t = -origin.y / direction.y;
    if (t < 0) {
      return null;
    }

    return {
      x: clamp(origin.x + direction.x * t, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT),
      z: clamp(origin.z + direction.z * t, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT)
    };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
