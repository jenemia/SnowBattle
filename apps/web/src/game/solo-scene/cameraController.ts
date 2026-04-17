import * as THREE from "three";

import { ARENA_HALF_EXTENT, type SessionSnapshot } from "@snowbattle/shared";

const CAMERA_HEIGHT = 34;
const CAMERA_LERP_SPEED = 8;
const CAMERA_LOOK_TARGET_Z_BIAS = 0.4;
const CAMERA_OFFSET_Z = 22;
const CAMERA_UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();

interface ViewportBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

export class SoloSceneCameraController {
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 250);
  private readonly idleCameraPosition = new THREE.Vector3(0, CAMERA_HEIGHT, CAMERA_OFFSET_Z);
  private readonly idleCameraQuaternion = getCameraQuaternionForSlot("A");
  private readonly raycaster = new THREE.Raycaster();
  private readonly screenNdc = new THREE.Vector2();
  private readonly scratchCameraPosition = new THREE.Vector3();
  private viewportBounds: ViewportBounds | null = null;

  constructor() {
    this.camera.position.copy(this.idleCameraPosition);
    this.camera.quaternion.copy(this.idleCameraQuaternion);
  }

  update(snapshot: SessionSnapshot | null, delta: number) {
    if (snapshot) {
      applyCameraRigTargets(snapshot, this.scratchCameraPosition);
    } else {
      this.scratchCameraPosition.copy(this.idleCameraPosition);
    }

    this.camera.position.lerp(
      this.scratchCameraPosition,
      1 - Math.exp(-CAMERA_LERP_SPEED * delta)
    );
    this.camera.quaternion.copy(
      snapshot
        ? getCameraQuaternionForSlot(snapshot.localPlayer.slot)
        : this.idleCameraQuaternion
    );
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setViewportBounds(bounds: DOMRectReadOnly) {
    this.viewportBounds = {
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width
    };
  }

  screenPointToWorld(clientX: number, clientY: number) {
    const bounds = this.viewportBounds;

    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
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

export function getCameraRigTargets(snapshot: SessionSnapshot) {
  const position = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  applyCameraRigTargets(snapshot, position);
  applyCameraRigLookTarget(snapshot, lookTarget);

  return {
    lookTarget,
    position
  };
}

export function getCameraRigQuaternion(slot: SessionSnapshot["localPlayer"]["slot"]) {
  return getCameraQuaternionForSlot(slot);
}

function applyCameraRigTargets(
  snapshot: SessionSnapshot,
  position: THREE.Vector3
) {
  const zDirection = snapshot.localPlayer.slot === "B" ? -1 : 1;

  position.set(
    snapshot.localPlayer.x,
    CAMERA_HEIGHT,
    snapshot.localPlayer.z + CAMERA_OFFSET_Z * zDirection
  );
}

function applyCameraRigLookTarget(snapshot: SessionSnapshot, lookTarget: THREE.Vector3) {
  const zDirection = snapshot.localPlayer.slot === "B" ? -1 : 1;

  lookTarget.set(
    snapshot.localPlayer.x,
    1.5,
    snapshot.localPlayer.z + CAMERA_LOOK_TARGET_Z_BIAS * zDirection
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCameraQuaternionForSlot(slot: SessionSnapshot["localPlayer"]["slot"]) {
  const zDirection = slot === "B" ? -1 : 1;
  const direction = new THREE.Vector3(
    0,
    1.5 - CAMERA_HEIGHT,
    (CAMERA_LOOK_TARGET_Z_BIAS - CAMERA_OFFSET_Z) * zDirection
  );
  const matrix = new THREE.Matrix4().lookAt(ORIGIN, direction, CAMERA_UP);
  const quaternion = new THREE.Quaternion();

  quaternion.setFromRotationMatrix(matrix);
  return quaternion;
}
