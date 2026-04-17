import type * as THREE from "three";

export interface RunnerParts {
  body: THREE.Mesh;
  group: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightArm: THREE.Mesh;
  rightLeg: THREE.Mesh;
  snowDrift: THREE.Mesh;
}
