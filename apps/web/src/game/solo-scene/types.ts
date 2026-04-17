import type * as THREE from "three";

import type {
  BlockyCharacterId,
  BlockyCharacterMotionName
} from "./blockyCharacterAssets";

export interface FallbackRunnerParts {
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightArm: THREE.Mesh;
  rightLeg: THREE.Mesh;
  root: THREE.Group;
}

export interface RunnerParts {
  actions: Partial<Record<BlockyCharacterMotionName, THREE.AnimationAction>>;
  activeCharacterId: BlockyCharacterId | null;
  currentMotion: BlockyCharacterMotionName | null;
  fallback: FallbackRunnerParts | null;
  group: THREE.Group;
  loadingCharacterId: BlockyCharacterId | null;
  mixer: THREE.AnimationMixer | null;
  runnerRoot: THREE.Group;
  snowDrift: THREE.Mesh;
  teamRing: THREE.Mesh;
}
