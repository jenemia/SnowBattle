import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { SlotId } from "@snowbattle/shared";

export const BLOCKY_CHARACTER_IDS = [
  "character-a",
  "character-b",
  "character-c",
  "character-d",
  "character-e",
  "character-f",
  "character-g",
  "character-h",
  "character-i",
  "character-j",
  "character-k",
  "character-l",
  "character-m",
  "character-n",
  "character-o",
  "character-p",
  "character-q",
  "character-r"
] as const;

export type BlockyCharacterId = (typeof BLOCKY_CHARACTER_IDS)[number];
export type BlockyCharacterMotionName =
  | "die"
  | "holding-right-shoot"
  | "idle"
  | "interact-right"
  | "walk";

export interface BlockyCharacterTemplate {
  animations: THREE.AnimationClip[];
  root: THREE.Group;
}

export interface BlockyCharacterInstance {
  animations: THREE.AnimationClip[];
  root: THREE.Group;
}

interface BlockyCharacterDefinition {
  textureUrl: string;
  url: string;
}

const BLOCKY_CHARACTER_HEIGHT = 3.35;
const BLOCKY_CHARACTER_GROUND_CLEARANCE = 0.08;
const BLOCKY_CHARACTER_DEFINITIONS: Record<BlockyCharacterId, BlockyCharacterDefinition> =
  Object.fromEntries(
    BLOCKY_CHARACTER_IDS.map((id) => [
      id,
      {
        textureUrl: new URL(
          `../../resources/kenney_blocky-characters_20/Models/GLB format/Textures/texture-${id.slice(-1)}.png`,
          import.meta.url
        ).href,
        url: new URL(
          `../../resources/kenney_blocky-characters_20/Models/GLB format/${id}.glb`,
          import.meta.url
        ).href
      }
    ])
  ) as Record<BlockyCharacterId, BlockyCharacterDefinition>;

const characterTemplateCache = new Map<
  BlockyCharacterId,
  Promise<BlockyCharacterTemplate>
>();

export async function createBlockyCharacterInstance(
  characterId: BlockyCharacterId
): Promise<BlockyCharacterInstance> {
  const template = await loadBlockyCharacterTemplate(characterId);

  return {
    animations: template.animations,
    root: cloneCharacterRoot(template.root)
  };
}

export function chooseBlockyCharacterId(
  guestName: string,
  slot: SlotId
): BlockyCharacterId {
  const seed = `${guestName.trim().toLowerCase()}::${slot}`;
  const hash = stableHash(seed);
  return BLOCKY_CHARACTER_IDS[hash % BLOCKY_CHARACTER_IDS.length];
}

export function getBlockyCharacterUrl(characterId: BlockyCharacterId) {
  return BLOCKY_CHARACTER_DEFINITIONS[characterId].url;
}

export function findBlockyMotionClip(
  animations: THREE.AnimationClip[],
  motionName: BlockyCharacterMotionName
) {
  return THREE.AnimationClip.findByName(animations, motionName) ?? null;
}

async function loadBlockyCharacterTemplate(characterId: BlockyCharacterId) {
  const cached = characterTemplateCache.get(characterId);

  if (cached) {
    return cached;
  }

  const definition = BLOCKY_CHARACTER_DEFINITIONS[characterId];
  const loader = createCharacterLoader(definition.textureUrl, characterId);
  const promise = loader.loadAsync(getBlockyCharacterUrl(characterId)).then((gltf) => ({
    animations: gltf.animations,
    root: prepareCharacterRoot(gltf.scene)
  }));

  characterTemplateCache.set(characterId, promise);
  return promise;
}

function prepareCharacterRoot(source: THREE.Object3D) {
  const root = cloneCharacterRoot(source);
  normalizeCharacterToGround(root);
  setCharacterShadowProps(root);
  return root;
}

function cloneCharacterRoot(source: THREE.Object3D) {
  const clone = source.clone(true) as THREE.Group;
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

  setCharacterShadowProps(clone);
  return clone;
}

function cloneMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    return material.map((entry) => entry.clone());
  }

  return material.clone();
}

function createCharacterLoader(textureUrl: string, characterId: BlockyCharacterId) {
  const manager = new THREE.LoadingManager();
  const textureFilename = `texture-${characterId.slice(-1)}.png`;

  manager.setURLModifier((url) => {
    const normalized = url.replace(/^(\.\/)+/, "");
    return normalized === `Textures/${textureFilename}` ? textureUrl : url;
  });

  return new GLTFLoader(manager);
}

function normalizeCharacterToGround(root: THREE.Object3D) {
  const initialBounds = new THREE.Box3().setFromObject(root);
  const initialSize = new THREE.Vector3();
  initialBounds.getSize(initialSize);
  const height = Math.max(initialSize.y, 0.001);
  const scale = BLOCKY_CHARACTER_HEIGHT / height;

  root.scale.multiplyScalar(scale);

  const scaledBounds = new THREE.Box3().setFromObject(root);
  root.position.y += BLOCKY_CHARACTER_GROUND_CLEARANCE - scaledBounds.min.y;
}

function setCharacterShadowProps(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
