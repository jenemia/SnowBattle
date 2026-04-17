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
  createHolidayAssetFallback,
  createHolidayAssetInstance,
  fitHolidayAssetToGround,
  type HolidayAssetKey
} from "./holidayKitAssets";

const STRUCTURE_MODEL_CONFIG: Record<
  BuildType,
  { assetKey: HolidayAssetKey; groundClearance: number; targetHeight: number }
> = {
  heater_beacon: {
    assetKey: "lantern",
    groundClearance: 0.03,
    targetHeight: 1
  },
  snowman_turret: {
    assetKey: "reindeer",
    groundClearance: 0.34,
    targetHeight: 2.3
  },
  wall: {
    assetKey: "snow-bunker",
    groundClearance: 0.03,
    targetHeight: 3
  }
};

export class SoloStructureRenderer {
  private readonly structureMeshes = new Map<string, THREE.Object3D>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(snapshot: SessionSnapshot) {
    const nextIds = new Set(snapshot.structures.map((structure) => structure.id));

    for (const structure of snapshot.structures) {
      let object = this.structureMeshes.get(structure.id);

      if (!object) {
        object = createStructureMesh(structure);
        this.structureMeshes.set(structure.id, object);
        this.scene.add(object);
      }

      object.position.set(structure.x, 0, structure.z);
      object.rotation.y = structure.rotationY ?? 0;
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
  const config = STRUCTURE_MODEL_CONFIG[structure.type];
  const fallback = fitHolidayAssetToGround(
    createHolidayAssetFallback(config.assetKey),
    {
      groundClearance: config.groundClearance,
      targetHeight: config.targetHeight
    }
  );
  container.add(fallback);

  void createHolidayAssetInstance(config.assetKey, {
    groundClearance: config.groundClearance,
    targetHeight: config.targetHeight
  }).then((model) => {
    if (!container.parent && container.children.length === 0) {
      return;
    }

    container.clear();
    container.add(model);
  });

  return container;
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
