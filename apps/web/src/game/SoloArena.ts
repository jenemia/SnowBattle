import * as THREE from "three";

import { ARENA_HALF_EXTENT, PLAYER_SPEED } from "@snowbattle/shared";

import { damp, dampAngle, getNormalizedMovement, movementLabel } from "./soloMath";

interface RunnerParts {
  body: THREE.Mesh;
  group: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightArm: THREE.Mesh;
  rightLeg: THREE.Mesh;
}

export interface SoloArenaSnapshot {
  facingDegrees: number;
  inputLabel: string;
  moving: boolean;
  speed: number;
  stridePhase: number;
  x: number;
  z: number;
}

const MAX_SPEED = PLAYER_SPEED;
const ACCELERATION = 14;
const TURN_SPEED = 12;
const BOUNDS = ARENA_HALF_EXTENT - 3;

export class SoloArena {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 250);
  private readonly clock = new THREE.Clock();
  private readonly pressedKeys = new Set<string>();
  private readonly position = new THREE.Vector2(0, 6);
  private readonly velocity = new THREE.Vector2();
  private readonly runner: RunnerParts;
  private facingAngle = Math.PI;
  private running = false;

  constructor(
    private readonly mount: HTMLElement,
    private readonly onFrame: (snapshot: SoloArenaSnapshot) => void
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.mount.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2("#07111b", 0.028);
    this.runner = this.buildScene();
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      this.tick();
    });
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.mount.removeChild(this.renderer.domElement);
  }

  private buildScene() {
    this.scene.add(new THREE.AmbientLight("#c1efff", 0.95));

    const sun = new THREE.DirectionalLight("#ffffff", 1.4);
    sun.position.set(12, 24, 10);
    sun.castShadow = true;
    this.scene.add(sun);

    const fill = new THREE.PointLight("#7be4ff", 18, 90, 2);
    fill.position.set(-14, 12, -6);
    this.scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(26, 88),
      new THREE.MeshStandardMaterial({
        color: "#def7ff",
        metalness: 0.05,
        roughness: 0.86
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(25.6, 0.36, 10, 120),
      new THREE.MeshStandardMaterial({
        color: "#8ee4ff",
        emissive: "#7be4ff",
        emissiveIntensity: 0.45
      })
    );
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    const grid = new THREE.GridHelper(44, 22, "#7be4ff", "#2f5268");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.26;
    this.scene.add(grid);

    this.addTrackMarkers();

    return this.createRunner();
  }

  private addTrackMarkers() {
    const positions = [
      [-12, -9],
      [10, -11],
      [-8, 10],
      [13, 8],
      [0, -15]
    ];

    for (const [x, z] of positions) {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 1.2, 1.5, 6),
        new THREE.MeshStandardMaterial({
          color: "#9fe9ff",
          emissive: "#7be4ff",
          emissiveIntensity: 0.22
        })
      );
      marker.position.set(x, 0.75, z);
      marker.castShadow = true;
      marker.receiveShadow = true;
      this.scene.add(marker);
    }
  }

  private createRunner(): RunnerParts {
    const group = new THREE.Group();
    this.scene.add(group);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.72, 1.65, 4, 8),
      new THREE.MeshStandardMaterial({
        color: "#72df49",
        emissive: "#67d640",
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
        color: "#7cea4d",
        roughness: 0.5
      })
    );
    head.position.set(0, 3.45, 0.14);
    head.castShadow = true;
    group.add(head);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: "#b8ff9d" })
    );
    nose.position.set(0, 3.28, 0.76);
    nose.rotation.x = Math.PI / 2;
    group.add(nose);

    const limbMaterial = new THREE.MeshStandardMaterial({
      color: "#60cf3f",
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

    group.position.set(this.position.x, 0.1, this.position.y);

    return {
      body,
      group,
      head,
      leftArm,
      leftLeg,
      rightArm,
      rightLeg
    };
  }

  private tick() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    const input = getNormalizedMovement(this.pressedKeys);
    const desiredVelocity = new THREE.Vector2(
      input.x * MAX_SPEED,
      input.y * MAX_SPEED
    );

    this.velocity.x = damp(
      this.velocity.x,
      desiredVelocity.x,
      ACCELERATION,
      delta
    );
    this.velocity.y = damp(
      this.velocity.y,
      desiredVelocity.y,
      ACCELERATION,
      delta
    );

    this.position.x = clamp(
      this.position.x + this.velocity.x * delta,
      -BOUNDS,
      BOUNDS
    );
    this.position.y = clamp(
      this.position.y + this.velocity.y * delta,
      -BOUNDS,
      BOUNDS
    );

    const speed = this.velocity.length();
    const moving = speed > 0.05;

    if (moving) {
      this.facingAngle = dampAngle(
        this.facingAngle,
        Math.atan2(this.velocity.x, this.velocity.y),
        TURN_SPEED,
        delta
      );
    }

    this.runner.group.position.set(this.position.x, 0.1, this.position.y);
    this.runner.group.rotation.y = this.facingAngle;
    this.animateRunner(elapsed, speed);
    this.updateCamera(delta);

    this.renderer.render(this.scene, this.camera);
    this.onFrame({
      facingDegrees: THREE.MathUtils.radToDeg(this.facingAngle),
      inputLabel: movementLabel(input),
      moving,
      speed,
      stridePhase: speed * elapsed,
      x: this.position.x,
      z: this.position.y
    });
  }

  private animateRunner(elapsed: number, speed: number) {
    const stride = Math.min(speed / MAX_SPEED, 1);
    const swing = Math.sin(elapsed * (6 + stride * 10)) * stride;
    const counterSwing = Math.sin(elapsed * (6 + stride * 10) + Math.PI) * stride;
    const bob = Math.sin(elapsed * (6 + stride * 10) * 2) * 0.08 * stride;

    this.runner.body.rotation.z = swing * 0.08;
    this.runner.body.position.y = 1.9 + bob;
    this.runner.head.position.y = 3.45 + bob * 0.7;
    this.runner.leftArm.rotation.x = swing * 0.95 - 0.3;
    this.runner.rightArm.rotation.x = counterSwing * 0.95 - 0.3;
    this.runner.leftLeg.rotation.x = counterSwing * 0.85;
    this.runner.rightLeg.rotation.x = swing * 0.85;
  }

  private updateCamera(delta: number) {
    const desiredPosition = new THREE.Vector3(
      this.position.x,
      17,
      this.position.y + 11
    );
    const desiredLookTarget = new THREE.Vector3(
      this.position.x,
      1.8,
      this.position.y + 0.8
    );

    this.camera.position.lerp(desiredPosition, 1 - Math.exp(-5 * delta));
    this.camera.lookAt(desiredLookTarget);
  }

  private readonly handleResize = () => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const key = normalizeMovementKey(event.key);

    if (key) {
      event.preventDefault();
      this.pressedKeys.add(key);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    const key = normalizeMovementKey(event.key);

    if (key) {
      event.preventDefault();
      this.pressedKeys.delete(key);
    }
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeMovementKey(key: string) {
  const normalized = key.length === 1 ? key.toLowerCase() : key;

  return [
    "w",
    "a",
    "s",
    "d",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight"
  ].includes(normalized)
    ? normalized
    : null;
}
