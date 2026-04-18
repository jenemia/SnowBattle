import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type HolidayStructureAssetKey =
  | "lantern"
  | "reindeer"
  | "snow-bunker";

type HolidayObstacleAssetKey =
  | "rocks-large"
  | "rocks-medium"
  | "rocks-small"
  | "tree-snow-a"
  | "tree-snow-b"
  | "tree-snow-c";

export type HolidayAssetKey = HolidayObstacleAssetKey | HolidayStructureAssetKey;

interface HolidayAssetDefinition {
  fallbackFactory: () => THREE.Object3D;
  url: string;
}

const HOLIDAY_TEXTURE_URLS = new Map<string, string>([
  [
    "Textures/colormap.png",
    new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/Textures/colormap.png",
      import.meta.url
    ).href
  ]
]);

export interface HolidayAssetInstanceOptions {
  groundClearance: number;
  targetDepth?: number;
  targetHeight: number;
  targetWidth?: number;
}

const assetTemplateCache = new Map<HolidayAssetKey, Promise<THREE.Object3D>>();

const HOLIDAY_ASSET_DEFINITIONS: Record<HolidayAssetKey, HolidayAssetDefinition> = {
  lantern: {
    fallbackFactory: createLanternFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/lantern.glb",
      import.meta.url
    ).href
  },
  reindeer: {
    fallbackFactory: createReindeerFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/reindeer.glb",
      import.meta.url
    ).href
  },
  "rocks-large": {
    fallbackFactory: createRockFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/rocks-large.glb",
      import.meta.url
    ).href
  },
  "rocks-medium": {
    fallbackFactory: createRockFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/rocks-medium.glb",
      import.meta.url
    ).href
  },
  "rocks-small": {
    fallbackFactory: createRockFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/rocks-small.glb",
      import.meta.url
    ).href
  },
  "snow-bunker": {
    fallbackFactory: createSnowBunkerFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/snow-bunker.glb",
      import.meta.url
    ).href
  },
  "tree-snow-a": {
    fallbackFactory: createTreeFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/tree-snow-a.glb",
      import.meta.url
    ).href
  },
  "tree-snow-b": {
    fallbackFactory: createTreeFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/tree-snow-b.glb",
      import.meta.url
    ).href
  },
  "tree-snow-c": {
    fallbackFactory: createTreeFallback,
    url: new URL(
      "../../resources/kenney_holiday-kit/Models/GLB format/tree-snow-c.glb",
      import.meta.url
    ).href
  }
};

export async function createHolidayAssetInstance(
  key: HolidayAssetKey,
  options: HolidayAssetInstanceOptions
) {
  const template = await loadHolidayAssetTemplate(key);
  const instance = cloneSceneGraph(template);
  fitHolidayAssetToGround(instance, options);
  setShadowProps(instance);

  return instance;
}

export function createHolidayAssetFallback(key: HolidayAssetKey) {
  const fallback = HOLIDAY_ASSET_DEFINITIONS[key].fallbackFactory();
  setShadowProps(fallback);
  return fallback;
}

export function fitHolidayAssetToGround(
  object: THREE.Object3D,
  options: HolidayAssetInstanceOptions
) {
  normalizeObjectToGround(
    object,
    options.targetHeight,
    options.groundClearance,
    options.targetWidth,
    options.targetDepth
  );
  return object;
}

function loadHolidayAssetTemplate(key: HolidayAssetKey) {
  const cached = assetTemplateCache.get(key);

  if (cached) {
    return cached;
  }

  const definition = HOLIDAY_ASSET_DEFINITIONS[key];
  const promise = createAssetLoader(HOLIDAY_TEXTURE_URLS)
    .loadAsync(definition.url)
    .then((gltf) => prepareHolidayAssetTemplate(gltf.scene))
    .catch(() => prepareHolidayAssetTemplate(definition.fallbackFactory()));

  assetTemplateCache.set(key, promise);
  return promise;
}

function prepareHolidayAssetTemplate(root: THREE.Object3D) {
  const template = root.clone(true);
  setShadowProps(template);
  return template;
}

function cloneSceneGraph(source: THREE.Object3D) {
  const clone = source.clone(true);
  const sourceMeshes: THREE.Mesh[] = [];
  const cloneMeshes: THREE.Mesh[] = [];

  source.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      sourceMeshes.push(child);
    }
  });
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      cloneMeshes.push(child);
    }
  });

  for (let index = 0; index < cloneMeshes.length; index += 1) {
    const sourceMesh = sourceMeshes[index];
    const cloneMesh = cloneMeshes[index];

    if (!sourceMesh || !cloneMesh) {
      continue;
    }

    cloneMesh.material = cloneMaterial(sourceMesh.material);
  }

  setShadowProps(clone);
  return clone;
}

function cloneMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    return material.map((entry) => entry.clone());
  }

  return material.clone();
}

function createAssetLoader(textureUrls: ReadonlyMap<string, string>) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const normalized = url.replace(/^(\.\/)+/, "");
    return textureUrls.get(normalized) ?? url;
  });

  return new GLTFLoader(manager);
}

function normalizeObjectToGround(
  object: THREE.Object3D,
  targetHeight: number,
  groundClearance: number,
  targetWidth?: number,
  targetDepth?: number
) {
  const initialBounds = new THREE.Box3().setFromObject(object);
  const initialSize = new THREE.Vector3();
  initialBounds.getSize(initialSize);
  const height = Math.max(initialSize.y, 0.001);
  const width = Math.max(initialSize.x, 0.001);
  const depth = Math.max(initialSize.z, 0.001);
  const scaleY = targetHeight / height;
  const scaleX = targetWidth ? targetWidth / width : scaleY;
  const scaleZ = targetDepth ? targetDepth / depth : scaleY;

  object.scale.multiply(new THREE.Vector3(scaleX, scaleY, scaleZ));

  const scaledBounds = new THREE.Box3().setFromObject(object);
  object.position.y += groundClearance - scaledBounds.min.y;
}

function setShadowProps(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function createTreeFallback() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: "#8d5d3f", roughness: 0.8 })
  );
  trunk.position.y = 0.45;
  group.add(trunk);
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.4, 10),
    new THREE.MeshStandardMaterial({ color: "#4fb87a", roughness: 0.72 })
  );
  canopy.position.y = 1.95;
  group.add(canopy);
  return group;
}

function createRockFallback() {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.9, 0),
    new THREE.MeshStandardMaterial({ color: "#c7d7ea", roughness: 0.92 })
  );
  rock.scale.set(1.2, 0.8, 1);
  return rock;
}

function createSnowBunkerFallback() {
  const bunker = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 18, 16),
    new THREE.MeshStandardMaterial({
      color: "#f5fbff",
      emissive: "#8ed8ff",
      emissiveIntensity: 0.12,
      roughness: 0.85
    })
  );
  bunker.scale.set(1.2, 0.7, 0.9);
  return bunker;
}

function createReindeerFallback() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 0.8),
    new THREE.MeshStandardMaterial({ color: "#b47a53", roughness: 0.72 })
  );
  body.position.y = 1.2;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: "#bf865b", roughness: 0.72 })
  );
  head.position.set(0, 1.75, 0.75);
  group.add(head);
  return group;
}

function createLanternFallback() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.36, 1.1, 12),
    new THREE.MeshStandardMaterial({ color: "#5a4031", roughness: 0.75 })
  );
  base.position.y = 0.55;
  group.add(base);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshStandardMaterial({
      color: "#ffd483",
      emissive: "#ff9f54",
      emissiveIntensity: 0.85,
      roughness: 0.25
    })
  );
  glow.position.y = 1.2;
  group.add(glow);
  return group;
}
