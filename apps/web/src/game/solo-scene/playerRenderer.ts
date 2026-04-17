import * as THREE from "three";

import type { SessionPlayerSnapshot, SessionSnapshot } from "@snowbattle/shared";

import {
  chooseBlockyCharacterId,
  createBlockyCharacterInstance,
  findBlockyMotionClip,
  type BlockyCharacterId,
  type BlockyCharacterInstance,
  type BlockyCharacterMotionName
} from "./blockyCharacterAssets";
import type { FallbackRunnerParts, RunnerParts } from "./types";

const PLAYER_POSITION_LERP_SPEED = 8;
const SNOW_DRIFT_BASE_SCALE_XZ = 0.72;
const SNOW_DRIFT_BASE_SCALE_Y = 0.2;
const TEAM_RING_PALETTE = {
  A: {
    color: new THREE.Color("#72df49"),
    emissive: new THREE.Color("#67d640")
  },
  B: {
    color: new THREE.Color("#ff90d5"),
    emissive: new THREE.Color("#a84cc8")
  }
} as const;
const WALK_MOVEMENT_THRESHOLD = 0.015;

interface SoloPlayerRendererOptions {
  loadCharacterInstance?: (characterId: BlockyCharacterId) => Promise<BlockyCharacterInstance>;
}

export class SoloPlayerRenderer {
  private readonly playerMeshes = new Map<string, RunnerParts>();
  private readonly loadCharacterInstance: (
    characterId: BlockyCharacterId
  ) => Promise<BlockyCharacterInstance>;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly clock: THREE.Clock,
    options: SoloPlayerRendererOptions = {}
  ) {
    this.loadCharacterInstance =
      options.loadCharacterInstance ?? createBlockyCharacterInstance;
  }

  sync(snapshot: SessionSnapshot, delta: number) {
    const lerpAlpha = 1 - Math.exp(-PLAYER_POSITION_LERP_SPEED * delta);

    for (const player of [snapshot.localPlayer, snapshot.opponentPlayer]) {
      let runner = this.playerMeshes.get(player.slot);
      const isLocal = player.slot === snapshot.localPlayer.slot;
      const targetCharacterId = chooseBlockyCharacterId(player.guestName, player.slot);

      if (!runner) {
        runner = createRunner(isLocal);
        this.playerMeshes.set(player.slot, runner);
        this.scene.add(runner.group);
      }

      const wasX = runner.group.position.x;
      const wasZ = runner.group.position.z;

      if (runner.group.position.lengthSq() === 0) {
        runner.group.position.set(player.x, 0.1, player.z);
      } else {
        runner.group.position.x = THREE.MathUtils.lerp(
          runner.group.position.x,
          player.x,
          lerpAlpha
        );
        runner.group.position.z = THREE.MathUtils.lerp(
          runner.group.position.z,
          player.z,
          lerpAlpha
        );
      }

      runner.group.rotation.y = player.facingAngle;
      runner.group.scale.setScalar(
        (isLocal ? 1 : 0.98) + (player.snowLoad / 100) * 0.03
      );
      runner.group.position.y = player.buildCooldownRemaining > 0 ? 0.14 : 0.1;

      if (
        runner.activeCharacterId !== targetCharacterId &&
        runner.loadingCharacterId !== targetCharacterId
      ) {
        this.loadCharacterForRunner(runner, targetCharacterId);
      }

      updateSnowDrift(runner, player);

      if (runner.mixer) {
        runner.mixer.update(delta);
      }

      const movementDistance = Math.hypot(
        runner.group.position.x - wasX,
        runner.group.position.z - wasZ
      );
      const motion = movementDistance > WALK_MOVEMENT_THRESHOLD ? "walk" : "idle";

      if (runner.mixer) {
        syncRunnerMotion(runner, motion);
      } else if (runner.fallback) {
        animateFallbackRunner(this.clock, runner.fallback, player.snowLoad);
      }
    }
  }

  private loadCharacterForRunner(runner: RunnerParts, characterId: BlockyCharacterId) {
    runner.loadingCharacterId = characterId;

    void this.loadCharacterInstance(characterId)
      .then((instance) => {
        if (runner.loadingCharacterId !== characterId) {
          return;
        }

        if (runner.runnerRoot.parent === runner.group) {
          runner.group.remove(runner.runnerRoot);
        }

        runner.runnerRoot = instance.root;
        runner.runnerRoot.name = `player-${characterId}`;
        runner.group.add(runner.runnerRoot);
        runner.activeCharacterId = characterId;
        runner.loadingCharacterId = null;
        runner.mixer = new THREE.AnimationMixer(runner.runnerRoot);
        runner.actions = createRunnerActions(
          runner.mixer,
          runner.runnerRoot,
          instance.animations
        );

        if (runner.fallback) {
          runner.fallback.root.visible = false;
        }

        positionSnowDriftNearFeet(runner);
        syncRunnerMotion(runner, runner.currentMotion ?? "idle", true);
      })
      .catch(() => {
        if (runner.loadingCharacterId === characterId) {
          runner.loadingCharacterId = null;
        }
      });
  }
}

function createRunner(isLocal: boolean): RunnerParts {
  const group = new THREE.Group();
  const fallback = createFallbackRunner(isLocal);
  const teamRing = createTeamRing(isLocal);
  const snowDrift = createSnowDrift();

  group.add(teamRing);
  group.add(fallback.root);
  group.add(snowDrift);

  return {
    actions: {},
    activeCharacterId: null,
    currentMotion: null,
    fallback,
    group,
    loadingCharacterId: null,
    mixer: null,
    runnerRoot: fallback.root,
    snowDrift,
    teamRing
  };
}

function createFallbackRunner(isLocal: boolean): FallbackRunnerParts {
  const root = new THREE.Group();
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
  root.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 10, 10),
    new THREE.MeshStandardMaterial({
      color: isLocal ? "#7cea4d" : "#ffc3ef",
      roughness: 0.5
    })
  );
  head.position.set(0, 3.45, 0.14);
  head.castShadow = true;
  root.add(head);

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
  root.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.85;
  rightArm.rotation.z = 0.48;
  root.add(rightArm);

  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 1.2, 3, 6),
    limbMaterial
  );
  leftLeg.position.set(-0.36, 0.95, 0.08);
  leftLeg.castShadow = true;
  root.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.36;
  root.add(rightLeg);

  return {
    body,
    head,
    leftArm,
    leftLeg,
    rightArm,
    rightLeg,
    root
  };
}

function createTeamRing(isLocal: boolean) {
  const palette = TEAM_RING_PALETTE[isLocal ? "A" : "B"];
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.92, 32),
    new THREE.MeshStandardMaterial({
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: 0.75,
      opacity: 0.88,
      roughness: 0.28,
      side: THREE.DoubleSide,
      transparent: true
    })
  );
  ring.name = `player-${isLocal ? "local" : "remote"}-team-ring`;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  return ring;
}

function createSnowDrift() {
  const snowDrift = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 12, 12),
    new THREE.MeshStandardMaterial({
      color: "#f6fdff",
      emissive: "#d8f5ff",
      emissiveIntensity: 0.22,
      roughness: 0.82,
      transparent: true
    })
  );
  snowDrift.position.set(0, 0.3, 0.08);
  snowDrift.scale.set(
    SNOW_DRIFT_BASE_SCALE_XZ,
    SNOW_DRIFT_BASE_SCALE_Y,
    SNOW_DRIFT_BASE_SCALE_XZ
  );
  snowDrift.visible = false;
  return snowDrift;
}

function createRunnerActions(
  mixer: THREE.AnimationMixer,
  root: THREE.Group,
  animations: THREE.AnimationClip[]
) {
  const actions: Partial<Record<BlockyCharacterMotionName, THREE.AnimationAction>> = {};

  for (const motionName of ["idle", "walk"] as const) {
    const clip = findBlockyMotionClip(animations, motionName);

    if (!clip) {
      continue;
    }

    const action = mixer.clipAction(clip, root);
    action.enabled = true;
    action.setLoop(THREE.LoopRepeat, Infinity);
    actions[motionName] = action;
  }

  return actions;
}

function syncRunnerMotion(
  runner: RunnerParts,
  nextMotion: BlockyCharacterMotionName,
  immediate = false
) {
  if (runner.currentMotion === nextMotion) {
    return;
  }

  const previousAction = runner.currentMotion
    ? runner.actions[runner.currentMotion]
    : undefined;
  const nextAction = runner.actions[nextMotion];

  runner.currentMotion = nextMotion;

  if (!nextAction) {
    return;
  }

  nextAction.reset();
  nextAction.enabled = true;

  if (previousAction && previousAction !== nextAction) {
    if (immediate) {
      previousAction.stop();
      nextAction.play();
    } else {
      nextAction.play();
      previousAction.crossFadeTo(nextAction, 0.18, false);
    }

    return;
  }

  nextAction.play();
}

function updateSnowDrift(runner: RunnerParts, player: SessionPlayerSnapshot) {
  const snowBlend = player.snowLoad / 100;

  runner.snowDrift.visible = snowBlend > 0.05;
  runner.snowDrift.scale.set(
    SNOW_DRIFT_BASE_SCALE_XZ + snowBlend * 1.1,
    SNOW_DRIFT_BASE_SCALE_Y + snowBlend * 0.18,
    SNOW_DRIFT_BASE_SCALE_XZ + snowBlend * 1.1
  );
}

function positionSnowDriftNearFeet(runner: RunnerParts) {
  const bounds = new THREE.Box3().setFromObject(runner.runnerRoot);
  const driftY = Math.min(0.38, bounds.min.y + 0.24);

  runner.snowDrift.position.y = driftY;
}

function animateFallbackRunner(
  clock: THREE.Clock,
  fallback: FallbackRunnerParts,
  snowLoad: number
) {
  const elapsed = clock.elapsedTime;
  const stride = 1 - snowLoad / 100;
  const swing = Math.sin(elapsed * (4 + stride * 8)) * stride;
  const counterSwing = Math.sin(elapsed * (4 + stride * 8) + Math.PI) * stride;
  const bob = Math.sin(elapsed * (4 + stride * 8) * 2) * 0.08 * stride;

  fallback.body.rotation.z = swing * 0.08;
  fallback.body.position.y = 1.9 + bob;
  fallback.head.position.y = 3.45 + bob * 0.7;
  fallback.leftArm.rotation.x = swing * 0.95 - 0.3;
  fallback.rightArm.rotation.x = counterSwing * 0.95 - 0.3;
  fallback.leftLeg.rotation.x = counterSwing * 0.85;
  fallback.rightLeg.rotation.x = swing * 0.85;
}
