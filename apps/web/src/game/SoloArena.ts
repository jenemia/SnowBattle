import * as THREE from "three";

import {
  ARENA_HALF_EXTENT,
  FIRE_COOLDOWN_MS,
  PLAYER_SPEED,
  PROJECTILE_SPEED,
  PROJECTILE_TTL_MS
} from "@snowbattle/shared";

import {
  IndexPool,
  circleIntersectsAabb,
  clamp,
  intersectRayWithGround,
  stepDurability
} from "./soloSandbox";
import {
  damp,
  dampAngle,
  getNormalizedMovement,
  movementLabel,
  normalizeMovementKey
} from "./soloMath";

type SoloMode = "build" | "combat";

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
  activeProjectiles: number;
  activeWalls: number;
  buildValid: boolean;
  cooldownMs: number;
  cursorX: number;
  cursorZ: number;
  facingDegrees: number;
  inputLabel: string;
  mode: SoloMode;
  moving: boolean;
  speed: number;
  stridePhase: number;
  x: number;
  z: number;
}

const ACCELERATION = 14;
const AIM_TURN_SPEED = 10;
const ARENA_BOUNDS = ARENA_HALF_EXTENT - 2;
const CAMERA_HEIGHT = 34;
const CAMERA_OFFSET_Z = 22;
const PLAYER_RADIUS = 0.9;
const PREVIEW_ALPHA = 0.38;
const PROJECTILE_RADIUS = 0.28;
const PROJECTILE_RENDER_Y = 1.5;
const PROJECTILE_SPAWN_DISTANCE = 1.35;
const TURN_SPEED = 12;
const WALL_HALF_DEPTH = 0.4;
const WALL_HALF_WIDTH = 1.5;
const WALL_HEIGHT = 3;
const WALL_MAX_DURABILITY = 5;

const CAMERA_FOCUS_BLEND = 0.32;
const CAMERA_LERP_SPEED = 4.4;
const MAX_PROJECTILES = 48;
const MAX_SPEED = PLAYER_SPEED;
const MAX_WALLS = 32;

export class SoloArena {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 250);
  private readonly clock = new THREE.Clock();
  private readonly pointerNdc = new THREE.Vector2(0, 0);
  private readonly pressedKeys = new Set<string>();
  private readonly position = new THREE.Vector2(0, 6);
  private readonly raycaster = new THREE.Raycaster();
  private readonly velocity = new THREE.Vector2();
  private readonly wallManager: WallManager;
  private readonly projectileManager: ProjectileManager;
  private readonly runner: RunnerParts;
  private readonly cursorMarker: THREE.Mesh;
  private readonly buildPreview: THREE.Mesh;
  private readonly buildPreviewMaterial: THREE.MeshStandardMaterial;
  private readonly scratchCameraPosition = new THREE.Vector3();
  private readonly scratchHit = new THREE.Vector3();
  private readonly scratchLookTarget = new THREE.Vector3();
  private readonly cursorWorld = new THREE.Vector3(0, 0, 0);
  private buildValid = false;
  private cursorActive = true;
  private facingAngle = Math.PI;
  private fireCooldownMs = 0;
  private mode: SoloMode = "combat";
  private running = false;

  constructor(
    private readonly mount: HTMLElement,
    private readonly onFrame: (snapshot: SoloArenaSnapshot) => void
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.style.cursor = "crosshair";
    this.mount.style.touchAction = "none";
    this.mount.appendChild(this.renderer.domElement);

    this.wallManager = new WallManager(this.scene);
    this.projectileManager = new ProjectileManager(this.scene);
    this.scene.fog = new THREE.FogExp2("#07111b", 0.026);

    const helpers = this.buildScene();
    this.runner = helpers.runner;
    this.cursorMarker = helpers.cursorMarker;
    this.buildPreview = helpers.buildPreview;
    this.buildPreviewMaterial = helpers.buildPreviewMaterial;

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.mount.addEventListener("contextmenu", this.handleContextMenu);
    this.mount.addEventListener("pointerdown", this.handlePointerDown);
    this.mount.addEventListener("pointermove", this.handlePointerMove);
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.clock.start();
    const bounds = this.mount.getBoundingClientRect();
    this.syncCursorFromClientPosition(
      bounds.left + bounds.width * 0.5,
      bounds.top + bounds.height * 0.5
    );
    this.renderer.setAnimationLoop(() => {
      this.tick();
    });
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.mount.removeEventListener("contextmenu", this.handleContextMenu);
    this.mount.removeEventListener("pointerdown", this.handlePointerDown);
    this.mount.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.mount.removeChild(this.renderer.domElement);
  }

  private buildScene() {
    this.scene.add(new THREE.AmbientLight("#c1efff", 0.95));

    const sun = new THREE.DirectionalLight("#ffffff", 1.45);
    sun.position.set(12, 28, 10);
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

    const cursorMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.8, 28),
      new THREE.MeshBasicMaterial({
        color: "#f4ffff",
        opacity: 0.72,
        side: THREE.DoubleSide,
        transparent: true
      })
    );
    cursorMarker.rotation.x = -Math.PI / 2;
    cursorMarker.position.y = 0.03;
    this.scene.add(cursorMarker);

    const buildPreviewMaterial = new THREE.MeshStandardMaterial({
      color: "#7be4ff",
      emissive: "#7be4ff",
      emissiveIntensity: 0.3,
      opacity: PREVIEW_ALPHA,
      roughness: 0.35,
      transparent: true
    });
    const buildPreview = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_HALF_WIDTH * 2, WALL_HEIGHT, WALL_HALF_DEPTH * 2),
      buildPreviewMaterial
    );
    buildPreview.position.y = WALL_HEIGHT / 2;
    buildPreview.visible = false;
    this.scene.add(buildPreview);

    return {
      buildPreview,
      buildPreviewMaterial,
      cursorMarker,
      runner: this.createRunner()
    };
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
    this.fireCooldownMs = Math.max(0, this.fireCooldownMs - delta * 1000);

    this.updateCursorWorld();
    const playerState = this.updatePlayer(delta);
    this.projectileManager.update(delta, this.wallManager);
    this.updateCamera(delta);
    this.updateCursorWorld();
    this.syncBuildPreviewState();
    this.updateModeVisuals();
    this.animateRunner(elapsed, playerState.speed);

    this.renderer.render(this.scene, this.camera);
    this.onFrame({
      activeProjectiles: this.projectileManager.activeCount,
      activeWalls: this.wallManager.activeCount,
      buildValid: this.buildValid,
      cooldownMs: this.fireCooldownMs,
      cursorX: this.cursorWorld.x,
      cursorZ: this.cursorWorld.z,
      facingDegrees: THREE.MathUtils.radToDeg(this.facingAngle),
      inputLabel: movementLabel(playerState.input),
      mode: this.mode,
      moving: playerState.moving,
      speed: playerState.speed,
      stridePhase: playerState.speed * elapsed,
      x: this.position.x,
      z: this.position.y
    });
  }

  private updatePlayer(delta: number) {
    const input = getNormalizedMovement(this.pressedKeys);
    const desiredVelocity = new THREE.Vector2(
      input.x * MAX_SPEED,
      input.y * MAX_SPEED
    );

    this.velocity.x = damp(this.velocity.x, desiredVelocity.x, ACCELERATION, delta);
    this.velocity.y = damp(this.velocity.y, desiredVelocity.y, ACCELERATION, delta);

    const previousPosition = { x: this.position.x, z: this.position.y };
    const nextPosition = {
      x: clamp(this.position.x + this.velocity.x * delta, -ARENA_BOUNDS, ARENA_BOUNDS),
      z: clamp(this.position.y + this.velocity.y * delta, -ARENA_BOUNDS, ARENA_BOUNDS)
    };
    const resolvedPosition = this.wallManager.resolvePlayerMovement(
      previousPosition,
      nextPosition,
      PLAYER_RADIUS
    );

    if (resolvedPosition.x !== nextPosition.x) {
      this.velocity.x = 0;
    }

    if (resolvedPosition.z !== nextPosition.z) {
      this.velocity.y = 0;
    }

    this.position.set(resolvedPosition.x, resolvedPosition.z);

    const speed = this.velocity.length();
    const moving = speed > 0.05;
    const aimX = this.cursorWorld.x - this.position.x;
    const aimZ = this.cursorWorld.z - this.position.y;
    const hasAim = Math.hypot(aimX, aimZ) > 0.1;

    if (moving || hasAim) {
      this.facingAngle = dampAngle(
        this.facingAngle,
        moving ? Math.atan2(this.velocity.x, this.velocity.y) : Math.atan2(aimX, aimZ),
        moving ? TURN_SPEED : AIM_TURN_SPEED,
        delta
      );
    }

    this.runner.group.position.set(this.position.x, 0.1, this.position.y);
    this.runner.group.rotation.y = this.facingAngle;

    return { input, moving, speed };
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
    const focusX =
      this.position.x + (this.cursorWorld.x - this.position.x) * CAMERA_FOCUS_BLEND;
    const focusZ =
      this.position.y + (this.cursorWorld.z - this.position.y) * CAMERA_FOCUS_BLEND;

    this.scratchCameraPosition.set(this.position.x, CAMERA_HEIGHT, this.position.y + CAMERA_OFFSET_Z);
    this.scratchLookTarget.set(focusX, 1.5, focusZ + 0.4);

    this.camera.position.lerp(
      this.scratchCameraPosition,
      1 - Math.exp(-CAMERA_LERP_SPEED * delta)
    );
    this.camera.lookAt(this.scratchLookTarget);
  }

  private updateCursorWorld() {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = intersectRayWithGround({
      direction: this.raycaster.ray.direction,
      origin: this.raycaster.ray.origin
    });

    if (!hit) {
      this.cursorActive = false;
      return;
    }

    this.cursorActive = true;
    this.cursorWorld.set(
      clamp(hit.x, -ARENA_BOUNDS, ARENA_BOUNDS),
      0,
      clamp(hit.z, -ARENA_BOUNDS, ARENA_BOUNDS)
    );
  }

  private screenToGround(clientX: number, clientY: number) {
    if (!this.updatePointerNdc(clientX, clientY)) {
      return null;
    }

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = intersectRayWithGround({
      direction: this.raycaster.ray.direction,
      origin: this.raycaster.ray.origin
    });

    if (!hit) {
      return null;
    }

    this.scratchHit.set(
      clamp(hit.x, -ARENA_BOUNDS, ARENA_BOUNDS),
      0,
      clamp(hit.z, -ARENA_BOUNDS, ARENA_BOUNDS)
    );

    return this.scratchHit;
  }

  private syncCursorFromClientPosition(clientX: number, clientY: number) {
    const hit = this.screenToGround(clientX, clientY);

    if (!hit) {
      this.cursorActive = false;
      this.syncBuildPreviewState();
      return false;
    }

    this.cursorActive = true;
    this.cursorWorld.copy(hit);
    this.syncBuildPreviewState();
    return true;
  }

  private syncBuildPreviewState() {
    this.buildValid =
      this.cursorActive &&
      this.mode === "build" &&
      this.wallManager.hasCapacity() &&
      this.wallManager.canPlace(
        this.cursorWorld.x,
        this.cursorWorld.z,
        this.position.x,
        this.position.y,
        PLAYER_RADIUS
      );
  }

  private updateModeVisuals() {
    this.cursorMarker.visible = this.mode === "combat" && this.cursorActive;
    this.cursorMarker.position.set(this.cursorWorld.x, 0.03, this.cursorWorld.z);

    this.buildPreview.visible = this.mode === "build" && this.cursorActive;
    this.buildPreview.position.set(this.cursorWorld.x, WALL_HEIGHT / 2, this.cursorWorld.z);
    this.buildPreviewMaterial.color.set(this.buildValid ? "#7be4ff" : "#ff9f80");
    this.buildPreviewMaterial.emissive.set(this.buildValid ? "#7be4ff" : "#ff8f7a");
  }

  private tryPrimaryAction() {
    if (!this.cursorActive) {
      return;
    }

    if (this.mode === "build") {
      if (
        this.buildValid &&
        this.wallManager.spawn(this.cursorWorld.x, this.cursorWorld.z)
      ) {
        this.mode = "combat";
      }

      return;
    }

    if (this.fireCooldownMs > 0) {
      return;
    }

    const aimX = this.cursorWorld.x - this.position.x;
    const aimZ = this.cursorWorld.z - this.position.y;
    const length = Math.hypot(aimX, aimZ);

    if (length < 0.001) {
      return;
    }

    const directionX = aimX / length;
    const directionZ = aimZ / length;
    const spawnX = this.position.x + directionX * PROJECTILE_SPAWN_DISTANCE;
    const spawnZ = this.position.y + directionZ * PROJECTILE_SPAWN_DISTANCE;

    if (
      this.projectileManager.spawn(spawnX, spawnZ, directionX, directionZ)
    ) {
      this.fireCooldownMs = FIRE_COOLDOWN_MS;
    }
  }

  private readonly handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private readonly handleResize = () => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const movementKey = normalizeMovementKey(event.key, event.code);

    if (movementKey) {
      event.preventDefault();
      this.pressedKeys.add(movementKey);
      return;
    }

    if (event.code === "Digit1" || event.code === "Numpad1") {
      event.preventDefault();
      this.mode = "build";
      this.syncBuildPreviewState();
      return;
    }

    if (event.code === "Escape") {
      event.preventDefault();
      this.mode = "combat";
      this.syncBuildPreviewState();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    const movementKey = normalizeMovementKey(event.key, event.code);

    if (movementKey) {
      event.preventDefault();
      this.pressedKeys.delete(movementKey);
    }
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.syncCursorFromClientPosition(event.clientX, event.clientY);
    this.tryPrimaryAction();
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    this.syncCursorFromClientPosition(event.clientX, event.clientY);
  };

  private updatePointerNdc(clientX: number, clientY: number) {
    const bounds = this.mount.getBoundingClientRect();

    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      clientX < bounds.left ||
      clientX > bounds.right ||
      clientY < bounds.top ||
      clientY > bounds.bottom
    ) {
      return false;
    }

    this.pointerNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    return true;
  }
}

class ProjectileManager {
  private readonly active = new Uint8Array(MAX_PROJECTILES);
  private readonly positionsX = new Float32Array(MAX_PROJECTILES);
  private readonly positionsZ = new Float32Array(MAX_PROJECTILES);
  private readonly ttlMs = new Float32Array(MAX_PROJECTILES);
  private readonly velocityX = new Float32Array(MAX_PROJECTILES);
  private readonly velocityZ = new Float32Array(MAX_PROJECTILES);
  private readonly dummy = new THREE.Object3D();
  private readonly pool = new IndexPool(MAX_PROJECTILES);
  readonly mesh: THREE.InstancedMesh;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(PROJECTILE_RADIUS, 14, 14),
      new THREE.MeshStandardMaterial({
        color: "#f4ffff",
        emissive: "#7be4ff",
        emissiveIntensity: 0.65,
        roughness: 0.18
      }),
      MAX_PROJECTILES
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    for (let index = 0; index < MAX_PROJECTILES; index += 1) {
      this.hideIndex(index);
    }
  }

  spawn(x: number, z: number, directionX: number, directionZ: number) {
    const index = this.pool.acquire();

    if (index === null) {
      return false;
    }

    this.active[index] = 1;
    this.positionsX[index] = x;
    this.positionsZ[index] = z;
    this.velocityX[index] = directionX * PROJECTILE_SPEED;
    this.velocityZ[index] = directionZ * PROJECTILE_SPEED;
    this.ttlMs[index] = PROJECTILE_TTL_MS;
    this.showIndex(index);
    return true;
  }

  update(delta: number, wallManager: WallManager) {
    const deltaMs = delta * 1000;

    for (let index = 0; index < MAX_PROJECTILES; index += 1) {
      if (this.active[index] === 0) {
        continue;
      }

      this.ttlMs[index] -= deltaMs;

      if (this.ttlMs[index] <= 0) {
        this.release(index);
        continue;
      }

      this.positionsX[index] += this.velocityX[index] * delta;
      this.positionsZ[index] += this.velocityZ[index] * delta;

      if (
        Math.abs(this.positionsX[index]) > ARENA_BOUNDS ||
        Math.abs(this.positionsZ[index]) > ARENA_BOUNDS
      ) {
        this.release(index);
        continue;
      }

      if (
        wallManager.hitProjectile(
          this.positionsX[index],
          this.positionsZ[index],
          PROJECTILE_RADIUS
        )
      ) {
        this.release(index);
        continue;
      }

      this.showIndex(index);
    }
  }

  get activeCount() {
    return this.pool.activeCount;
  }

  private release(index: number) {
    if (this.active[index] === 0) {
      return;
    }

    this.active[index] = 0;
    this.pool.release(index);
    this.hideIndex(index);
  }

  private hideIndex(index: number) {
    this.dummy.position.set(0, -1000, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private showIndex(index: number) {
    this.dummy.position.set(
      this.positionsX[index],
      PROJECTILE_RENDER_Y,
      this.positionsZ[index]
    );
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class WallManager {
  private readonly active = new Uint8Array(MAX_WALLS);
  private readonly damageColor = new THREE.Color("#ff9f80");
  private readonly durability = new Uint8Array(MAX_WALLS);
  private readonly healthyColor = new THREE.Color("#79e1ff");
  private readonly positionsX = new Float32Array(MAX_WALLS);
  private readonly positionsZ = new Float32Array(MAX_WALLS);
  private readonly color = new THREE.Color();
  private readonly dummy = new THREE.Object3D();
  private readonly pool = new IndexPool(MAX_WALLS);
  readonly mesh: THREE.InstancedMesh;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(WALL_HALF_WIDTH * 2, WALL_HEIGHT, WALL_HALF_DEPTH * 2),
      new THREE.MeshStandardMaterial({
        color: "#79e1ff",
        emissive: "#7be4ff",
        emissiveIntensity: 0.3,
        metalness: 0.05,
        roughness: 0.42
      }),
      MAX_WALLS
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    for (let index = 0; index < MAX_WALLS; index += 1) {
      this.hideIndex(index);
      this.mesh.setColorAt(index, this.healthyColor);
    }

    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  canPlace(
    x: number,
    z: number,
    playerX: number,
    playerZ: number,
    playerRadius: number
  ) {
    const withinArena =
      x - WALL_HALF_WIDTH >= -ARENA_BOUNDS &&
      x + WALL_HALF_WIDTH <= ARENA_BOUNDS &&
      z - WALL_HALF_DEPTH >= -ARENA_BOUNDS &&
      z + WALL_HALF_DEPTH <= ARENA_BOUNDS;

    if (!withinArena) {
      return false;
    }

    if (
      circleIntersectsAabb(
        playerX,
        playerZ,
        playerRadius,
        x,
        z,
        WALL_HALF_WIDTH,
        WALL_HALF_DEPTH
      )
    ) {
      return false;
    }

    for (let index = 0; index < MAX_WALLS; index += 1) {
      if (this.active[index] === 0) {
        continue;
      }

      if (
        Math.abs(this.positionsX[index] - x) < WALL_HALF_WIDTH * 2 &&
        Math.abs(this.positionsZ[index] - z) < WALL_HALF_DEPTH * 2
      ) {
        return false;
      }
    }

    return true;
  }

  spawn(x: number, z: number) {
    const index = this.pool.acquire();

    if (index === null) {
      return false;
    }

    this.active[index] = 1;
    this.durability[index] = WALL_MAX_DURABILITY;
    this.positionsX[index] = x;
    this.positionsZ[index] = z;
    this.showIndex(index);
    this.applyColor(index);
    return true;
  }

  hasCapacity() {
    return this.pool.activeCount < MAX_WALLS;
  }

  hitProjectile(x: number, z: number, radius: number) {
    for (let index = 0; index < MAX_WALLS; index += 1) {
      if (this.active[index] === 0) {
        continue;
      }

      if (
        circleIntersectsAabb(
          x,
          z,
          radius,
          this.positionsX[index],
          this.positionsZ[index],
          WALL_HALF_WIDTH,
          WALL_HALF_DEPTH
        )
      ) {
        this.damage(index);
        return true;
      }
    }

    return false;
  }

  resolvePlayerMovement(
    previousPosition: { x: number; z: number },
    nextPosition: { x: number; z: number },
    radius: number
  ) {
    let resolvedX = nextPosition.x;

    for (let index = 0; index < MAX_WALLS; index += 1) {
      if (this.active[index] === 0) {
        continue;
      }

      if (
        circleIntersectsAabb(
          resolvedX,
          previousPosition.z,
          radius,
          this.positionsX[index],
          this.positionsZ[index],
          WALL_HALF_WIDTH,
          WALL_HALF_DEPTH
        )
      ) {
        resolvedX = previousPosition.x;
        break;
      }
    }

    let resolvedZ = nextPosition.z;

    for (let index = 0; index < MAX_WALLS; index += 1) {
      if (this.active[index] === 0) {
        continue;
      }

      if (
        circleIntersectsAabb(
          resolvedX,
          resolvedZ,
          radius,
          this.positionsX[index],
          this.positionsZ[index],
          WALL_HALF_WIDTH,
          WALL_HALF_DEPTH
        )
      ) {
        resolvedZ = previousPosition.z;
        break;
      }
    }

    return { x: resolvedX, z: resolvedZ };
  }

  get activeCount() {
    return this.pool.activeCount;
  }

  private damage(index: number) {
    this.durability[index] = stepDurability(this.durability[index]);

    if (this.durability[index] === 0) {
      this.release(index);
      return;
    }

    this.applyColor(index);
  }

  private release(index: number) {
    if (this.active[index] === 0) {
      return;
    }

    this.active[index] = 0;
    this.pool.release(index);
    this.hideIndex(index);
  }

  private applyColor(index: number) {
    const durabilityRatio = this.durability[index] / WALL_MAX_DURABILITY;
    this.color.copy(this.damageColor).lerp(this.healthyColor, durabilityRatio);
    this.mesh.setColorAt(index, this.color);

    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  private hideIndex(index: number) {
    this.dummy.position.set(0, -1000, 0);
    this.dummy.scale.set(0.001, 0.001, 0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private showIndex(index: number) {
    this.dummy.position.set(this.positionsX[index], WALL_HEIGHT / 2, this.positionsZ[index]);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
