import * as THREE from "three";

import type { SessionSnapshot } from "@snowbattle/shared";

import type { RunnerParts } from "./types";

const BODY_SNOW_TINT = new THREE.Color("#edf8ff");
const HEAD_SNOW_TINT = new THREE.Color("#ffffff");
const PLAYER_PALETTE = {
  A: {
    body: new THREE.Color("#72df49"),
    emissive: new THREE.Color("#67d640"),
    head: new THREE.Color("#7cea4d")
  },
  B: {
    body: new THREE.Color("#ff90d5"),
    emissive: new THREE.Color("#a84cc8"),
    head: new THREE.Color("#ffc3ef")
  }
} as const;

export class SoloPlayerRenderer {
  private readonly playerMeshes = new Map<string, RunnerParts>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly clock: THREE.Clock
  ) {}

  sync(snapshot: SessionSnapshot) {
    for (const player of [snapshot.localPlayer, snapshot.opponentPlayer]) {
      let runner = this.playerMeshes.get(player.slot);

      if (!runner) {
        runner = createRunner(player.slot === snapshot.localPlayer.slot);
        this.playerMeshes.set(player.slot, runner);
        this.scene.add(runner.group);
      }

      const snowBlend = player.snowLoad / 100;
      const palette = PLAYER_PALETTE[player.slot];
      const bodyMaterial = runner.body.material as THREE.MeshStandardMaterial;
      const headMaterial = runner.head.material as THREE.MeshStandardMaterial;
      bodyMaterial.color.copy(palette.body).lerp(BODY_SNOW_TINT, snowBlend * 0.7);
      bodyMaterial.emissive.copy(palette.emissive);
      headMaterial.color.copy(palette.head).lerp(HEAD_SNOW_TINT, snowBlend * 0.8);
      runner.snowCap.visible = snowBlend > 0.05;
      runner.snowCap.scale.setScalar(0.65 + snowBlend * 0.9);
      runner.snowCap.position.y = 3.95 + snowBlend * 0.2;
      runner.group.position.set(player.x, 0.1, player.z);
      runner.group.rotation.y = player.facingAngle;
      runner.group.scale.setScalar(
        (player.slot === snapshot.localPlayer.slot ? 1 : 0.98) + snowBlend * 0.03
      );
      animateRunner(this.clock, runner, player.snowLoad, player.buildCooldownRemaining);
    }
  }
}

function createRunner(isLocal: boolean): RunnerParts {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.72, 1.65, 4, 8),
    new THREE.MeshStandardMaterial({
      color: isLocal ? "#72df49" : "#ff90d5",
      emissive: isLocal ? "#67d640" : "#a84cc8",
      emissiveIntensity: 0.3,
      roughness: 0.42
    })
  );
  body.castShadow = true;
  body.position.y = 1.9;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 10, 10),
    new THREE.MeshStandardMaterial({
      color: isLocal ? "#7cea4d" : "#ffc3ef",
      roughness: 0.5
    })
  );
  head.position.set(0, 3.45, 0.14);
  head.castShadow = true;
  group.add(head);

  const snowCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.58, 10, 10),
    new THREE.MeshStandardMaterial({
      color: "#f6fdff",
      emissive: "#d8f5ff",
      emissiveIntensity: 0.22,
      roughness: 0.82,
      transparent: true
    })
  );
  snowCap.position.set(0, 3.95, 0.18);
  snowCap.scale.setScalar(0.65);
  snowCap.visible = false;
  group.add(snowCap);

  const limbMaterial = new THREE.MeshStandardMaterial({
    color: isLocal ? "#60cf3f" : "#ff82cf",
    roughness: 0.52
  });

  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 1.1, 3, 6),
    limbMaterial
  );
  leftArm.position.set(-0.85, 2.35, 0);
  leftArm.rotation.z = -0.48;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.85;
  rightArm.rotation.z = 0.48;
  group.add(rightArm);

  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 1.2, 3, 6),
    limbMaterial
  );
  leftLeg.position.set(-0.36, 0.95, 0.08);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.36;
  group.add(rightLeg);

  return {
    body,
    group,
    head,
    leftArm,
    leftLeg,
    rightArm,
    rightLeg,
    snowCap
  };
}

function animateRunner(
  clock: THREE.Clock,
  runner: RunnerParts,
  snowLoad: number,
  buildCooldownRemaining: number
) {
  const elapsed = clock.elapsedTime;
  const stride = 1 - snowLoad / 100;
  const swing = Math.sin(elapsed * (4 + stride * 8)) * stride;
  const counterSwing = Math.sin(elapsed * (4 + stride * 8) + Math.PI) * stride;
  const bob = Math.sin(elapsed * (4 + stride * 8) * 2) * 0.08 * stride;

  runner.body.rotation.z = swing * 0.08;
  runner.body.position.y = 1.9 + bob;
  runner.head.position.y = 3.45 + bob * 0.7;
  runner.leftArm.rotation.x = swing * 0.95 - 0.3;
  runner.rightArm.rotation.x = counterSwing * 0.95 - 0.3;
  runner.leftLeg.rotation.x = counterSwing * 0.85;
  runner.rightLeg.rotation.x = swing * 0.85;
  runner.group.position.y = buildCooldownRemaining > 0 ? 0.14 : 0.1;
}
