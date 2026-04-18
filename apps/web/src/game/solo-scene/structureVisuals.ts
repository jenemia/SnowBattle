import * as THREE from "three";

import {
  SOLO_WALL_HALF_DEPTH,
  SOLO_WALL_HALF_WIDTH,
  type BuildType
} from "@snowbattle/shared";

import {
  createHolidayAssetFallback,
  createHolidayAssetInstance,
  fitHolidayAssetToGround,
  type HolidayAssetInstanceOptions,
  type HolidayAssetKey
} from "./holidayKitAssets";

interface StructureVisualConfig extends HolidayAssetInstanceOptions {
  assetKey: HolidayAssetKey;
}

export const STRUCTURE_VISUAL_CONFIG: Record<BuildType, StructureVisualConfig> = {
  heater_beacon: {
    assetKey: "lantern",
    groundClearance: 0.03,
    targetHeight: 3
  },
  snowman_turret: {
    assetKey: "reindeer",
    groundClearance: 0.34,
    targetHeight: 2.3
  },
  wall: {
    assetKey: "snow-bunker",
    groundClearance: 0.03,
    targetDepth: SOLO_WALL_HALF_DEPTH * 2,
    targetHeight: 4.5,
    targetWidth: SOLO_WALL_HALF_WIDTH * 2
  }
};

export function getStructureVisualConfig(buildType: BuildType) {
  return STRUCTURE_VISUAL_CONFIG[buildType];
}

export function createStructureFallback(buildType: BuildType) {
  const config = getStructureVisualConfig(buildType);
  return fitHolidayAssetToGround(createHolidayAssetFallback(config.assetKey), config);
}

export function createStructurePreviewFallback(buildType: BuildType) {
  return applyPreviewMaterial(createStructureFallback(buildType));
}

export async function createStructureInstance(buildType: BuildType) {
  const config = getStructureVisualConfig(buildType);
  return createHolidayAssetInstance(config.assetKey, config);
}

export async function createStructurePreviewInstance(buildType: BuildType) {
  const instance = await createStructureInstance(buildType);
  return applyPreviewMaterial(instance);
}

function applyPreviewMaterial(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;
    child.material = createPreviewMaterial(child.material);
  });

  return root;
}

function createPreviewMaterial(
  material: THREE.Material | THREE.Material[]
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((entry) => createPreviewMaterial(entry) as THREE.Material);
  }

  if (material instanceof THREE.MeshStandardMaterial) {
    const ghost = material.clone();
    ghost.color.multiplyScalar(1.1);
    ghost.emissive = new THREE.Color("#7be4ff");
    ghost.emissiveIntensity = 0.42;
    ghost.opacity = 0.38;
    ghost.transparent = true;
    ghost.depthWrite = false;
    return ghost;
  }

  const ghost = new THREE.MeshStandardMaterial({
    color: "#c8f7ff",
    emissive: "#7be4ff",
    emissiveIntensity: 0.42,
    opacity: 0.38,
    roughness: 0.35,
    transparent: true
  });
  ghost.depthWrite = false;
  return ghost;
}
