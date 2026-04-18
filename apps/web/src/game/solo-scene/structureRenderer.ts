import * as THREE from "three";

import {
  SOLO_HEATER_BEACON_HP,
  SOLO_SNOWMAN_TURRET_HP,
  SOLO_WALL_HP,
  type BuildType,
  type SessionSnapshot,
  type SessionStructureSnapshot
} from "@snowbattle/shared";

import {
  createStructureFallback,
  createStructureInstance
} from "./structureVisuals";

const STRUCTURE_ROTATION_LERP_SPEED = 14;

export class SoloStructureRenderer {
  private readonly structureMeshes = new Map<string, THREE.Object3D>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(snapshot: SessionSnapshot, delta = 1 / 60) {
    const nextIds = new Set(snapshot.structures.map((structure) => structure.id));

    for (const structure of snapshot.structures) {
      let object = this.structureMeshes.get(structure.id);

      if (!object) {
        object = createStructureMesh(structure);
        this.structureMeshes.set(structure.id, object);
        this.scene.add(object);
      }

      object.position.set(structure.x, 0, structure.z);
      object.rotation.y = getStructureRotationY(object, structure, delta);
      object.visible = structure.enabled;
      updateStructureVisual(object, structure);
    }

    for (const [id, object] of this.structureMeshes) {
      if (!nextIds.has(id)) {
        this.scene.remove(object);
        this.structureMeshes.delete(id);
      }
    }
  }
}

function createStructureMesh(structure: SessionStructureSnapshot) {
  const container = new THREE.Group();
  container.userData.structureType = structure.type;
  container.userData.displayRotationY = structure.rotationY ?? 0;
  const fallback = createStructureFallback(structure.type);
  container.add(fallback);

  void createStructureInstance(structure.type).then((model) => {
    if (!container.parent) {
      return;
    }

    container.clear();
    container.add(model);
  });

  return container;
}

function getStructureRotationY(
  object: THREE.Object3D,
  structure: SessionStructureSnapshot,
  delta: number
) {
  const baseRotation = structure.rotationY ?? 0;

  if (structure.type !== "snowman_turret") {
    object.userData.displayRotationY = baseRotation;
    return baseRotation;
  }

  const targetRotation = structure.aimRotationY ?? baseRotation;
  const currentRotation =
    typeof object.userData.displayRotationY === "number"
      ? object.userData.displayRotationY
      : baseRotation;
  const alpha = 1 - Math.exp(-STRUCTURE_ROTATION_LERP_SPEED * delta);
  const nextRotation = lerpAngle(currentRotation, targetRotation, alpha);

  object.userData.displayRotationY = nextRotation;
  return nextRotation;
}

function updateStructureVisual(
  object: THREE.Object3D,
  structure: SessionStructureSnapshot
) {
  const maxHp = getStructureMaxHp(structure.type);
  const ratio = Math.max(0.25, structure.hp / maxHp);

  object.scale.setScalar(1);

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const material = child.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) {
      return;
    }

    if (structure.type === "wall") {
      material.color.set("#d6efff").lerp(new THREE.Color("#ffffff"), ratio);
    } else if (structure.type === "snowman_turret") {
      material.color.set("#c48a66").lerp(new THREE.Color("#f6e5d6"), ratio);
    } else {
      material.color.set("#8b6a52").lerp(new THREE.Color("#ffd696"), ratio);
    }

    material.emissiveIntensity =
      structure.type === "heater_beacon" ? 0.45 + (1 - ratio) * 0.2 : 0.25 + (1 - ratio) * 0.3;
  });
}

function getStructureMaxHp(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_HP;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_HP;
  }

  return SOLO_HEATER_BEACON_HP;
}

function lerpAngle(from: number, to: number, alpha: number) {
  const delta = (((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return from + delta * alpha;
}
