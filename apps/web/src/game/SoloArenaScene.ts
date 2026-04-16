import * as THREE from "three";

import {
  ARENA_HALF_EXTENT,
  SOLO_HEATER_BEACON_HP,
  SOLO_HEATER_BEACON_RADIUS,
  SOLO_SNOWMAN_TURRET_HP,
  SOLO_STRUCTURE_COLLISION_RADIUS,
  SOLO_WALL_HALF_DEPTH,
  SOLO_WALL_HALF_WIDTH,
  SOLO_WALL_HP
} from "@snowbattle/shared";
import type {
  BuildType,
  SessionSnapshot,
  SessionStructureSnapshot
} from "@snowbattle/shared";

interface RunnerParts {
  body: THREE.Mesh;
  group: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightArm: THREE.Mesh;
  rightLeg: THREE.Mesh;
  snowCap: THREE.Mesh;
}

const CAMERA_HEIGHT = 34;
const CAMERA_LERP_SPEED = 4.4;
const CAMERA_OFFSET_Z = 22;
const CURSOR_RING_Y = 0.03;
const PREVIEW_ALPHA = 0.38;
const PROJECTILE_RENDER_Y = 1.4;

export class SoloArenaScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 250);
  private readonly clock = new THREE.Clock();
  private readonly playerMeshes = new Map<string, RunnerParts>();
  private readonly projectileMeshes = new Map<string, THREE.Mesh>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly scratchCameraPosition = new THREE.Vector3();
  private readonly scratchLookTarget = new THREE.Vector3();
  private readonly screenNdc = new THREE.Vector2();
  private readonly structureMeshes = new Map<string, THREE.Object3D>();
  private readonly buildPreview: THREE.Mesh;
  private readonly buildPreviewMaterial: THREE.MeshStandardMaterial;
  private readonly cursorMarker: THREE.Mesh;
  private readonly bonfireGroup: THREE.Group;
  private readonly bonfireLight: THREE.PointLight;
  private readonly whiteoutRing: THREE.Mesh;
  private latestSnapshot: SessionSnapshot | null = null;
  private running = false;

  constructor(private readonly mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.mount.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2("#07111b", 0.026);
    this.buildScene();

    this.cursorMarker = this.createCursorMarker();
    this.scene.add(this.cursorMarker);

    this.buildPreviewMaterial = new THREE.MeshStandardMaterial({
      color: "#7be4ff",
      emissive: "#7be4ff",
      emissiveIntensity: 0.3,
      opacity: PREVIEW_ALPHA,
      roughness: 0.35,
      transparent: true
    });
    this.buildPreview = new THREE.Mesh(
      new THREE.BoxGeometry(SOLO_WALL_HALF_WIDTH * 2, 3, SOLO_WALL_HALF_DEPTH * 2),
      this.buildPreviewMaterial
    );
    this.buildPreview.visible = false;
    this.scene.add(this.buildPreview);

    this.whiteoutRing = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.12, 80),
      new THREE.MeshBasicMaterial({
        color: "#ff9f80",
        opacity: 0.72,
        side: THREE.DoubleSide,
        transparent: true
      })
    );
    this.whiteoutRing.rotation.x = -Math.PI / 2;
    this.whiteoutRing.position.y = 0.04;
    this.whiteoutRing.visible = false;
    this.scene.add(this.whiteoutRing);

    this.bonfireGroup = new THREE.Group();
    const bonfireBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.15, 0.45, 10),
      new THREE.MeshStandardMaterial({
        color: "#6f4a2d",
        roughness: 0.74
      })
    );
    bonfireBase.position.y = 0.25;
    bonfireBase.castShadow = true;
    this.bonfireGroup.add(bonfireBase);
    const bonfireFlame = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({
        color: "#ffcc87",
        emissive: "#ff8f5c",
        emissiveIntensity: 1.1
      })
    );
    bonfireFlame.position.y = 1.15;
    this.bonfireGroup.add(bonfireFlame);
    this.bonfireLight = new THREE.PointLight("#ff914f", 0, 16, 2);
    this.bonfireLight.position.y = 1.8;
    this.bonfireGroup.add(this.bonfireLight);
    this.bonfireGroup.visible = false;
    this.scene.add(this.bonfireGroup);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      this.renderFrame();
    });
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.mount.removeChild(this.renderer.domElement);
  }

  render(snapshot: SessionSnapshot) {
    this.latestSnapshot = snapshot;
    this.syncPlayers(snapshot);
    this.syncProjectiles(snapshot);
    this.syncStructures(snapshot);
    this.syncOverlays(snapshot);
  }

  screenPointToWorld(clientX: number, clientY: number) {
    const bounds = this.renderer.domElement.getBoundingClientRect();

    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    this.screenNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    this.screenNdc.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.screenNdc, this.camera);

    const { direction, origin } = this.raycaster.ray;
    if (Math.abs(direction.y) < 1e-6) {
      return null;
    }

    const t = -origin.y / direction.y;
    if (t < 0) {
      return null;
    }

    return {
      x: clamp(origin.x + direction.x * t, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT),
      z: clamp(origin.z + direction.z * t, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT)
    };
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

    const markers = [
      [-12, -9],
      [10, -11],
      [-8, 10],
      [13, 8],
      [0, -15]
    ];

    for (const [x, z] of markers) {
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

  private createCursorMarker() {
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
    cursorMarker.position.y = CURSOR_RING_Y;
    return cursorMarker;
  }

  private renderFrame() {
    if (this.latestSnapshot) {
      this.updateCamera(this.latestSnapshot, this.clock.getDelta());
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(snapshot: SessionSnapshot, delta: number) {
    const focusX =
      snapshot.localPlayer.x +
      (snapshot.hud.cursorX - snapshot.localPlayer.x) * 0.32;
    const focusZ =
      snapshot.localPlayer.z +
      (snapshot.hud.cursorZ - snapshot.localPlayer.z) * 0.32;

    this.scratchCameraPosition.set(
      snapshot.localPlayer.x,
      CAMERA_HEIGHT,
      snapshot.localPlayer.z + CAMERA_OFFSET_Z
    );
    this.scratchLookTarget.set(focusX, 1.5, focusZ + 0.4);

    this.camera.position.lerp(
      this.scratchCameraPosition,
      1 - Math.exp(-CAMERA_LERP_SPEED * delta)
    );
    this.camera.lookAt(this.scratchLookTarget);
  }

  private syncPlayers(snapshot: SessionSnapshot) {
    for (const player of [snapshot.localPlayer, snapshot.opponentPlayer]) {
      let runner = this.playerMeshes.get(player.slot);

      if (!runner) {
        runner = this.createRunner(player.slot === snapshot.localPlayer.slot);
        this.playerMeshes.set(player.slot, runner);
        this.scene.add(runner.group);
      }

      const snowBlend = player.snowLoad / 100;
      const bodyMaterial = runner.body.material as THREE.MeshStandardMaterial;
      const headMaterial = runner.head.material as THREE.MeshStandardMaterial;
      bodyMaterial.color.set(player.slot === "A" ? "#72df49" : "#ff90d5");
      bodyMaterial.color.lerp(new THREE.Color("#edf8ff"), snowBlend * 0.7);
      bodyMaterial.emissive.set(player.slot === "A" ? "#67d640" : "#a84cc8");
      headMaterial.color.set("#7cea4d").lerp(new THREE.Color("#ffffff"), snowBlend * 0.8);
      runner.snowCap.visible = snowBlend > 0.05;
      runner.snowCap.scale.setScalar(0.65 + snowBlend * 0.9);
      runner.snowCap.position.y = 3.95 + snowBlend * 0.2;
      runner.group.position.set(player.x, 0.1, player.z);
      runner.group.rotation.y = player.facingAngle;
      runner.group.scale.setScalar(
        (player.slot === snapshot.localPlayer.slot ? 1 : 0.98) + snowBlend * 0.03
      );
      this.animateRunner(runner, player.snowLoad, player.buildCooldownRemaining);
    }
  }

  private syncProjectiles(snapshot: SessionSnapshot) {
    const nextIds = new Set(snapshot.projectiles.map((projectile) => projectile.id));

    for (const projectile of snapshot.projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);

      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 14, 14),
          new THREE.MeshStandardMaterial({
            color: projectile.ownerSlot === "A" ? "#f4ffff" : "#ffd6f7",
            emissive: projectile.ownerSlot === "A" ? "#7be4ff" : "#ff8cd6",
            emissiveIntensity: 0.65,
            roughness: 0.18
          })
        );
        mesh.castShadow = true;
        this.projectileMeshes.set(projectile.id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(projectile.x, PROJECTILE_RENDER_Y, projectile.z);
    }

    for (const [projectileId, mesh] of this.projectileMeshes) {
      if (!nextIds.has(projectileId)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(projectileId);
      }
    }
  }

  private syncStructures(snapshot: SessionSnapshot) {
    const nextIds = new Set(snapshot.structures.map((structure) => structure.id));

    for (const structure of snapshot.structures) {
      let object = this.structureMeshes.get(structure.id);

      if (!object) {
        object = this.createStructureMesh(structure);
        this.structureMeshes.set(structure.id, object);
        this.scene.add(object);
      }

      object.position.set(structure.x, 0, structure.z);
      object.visible = structure.enabled;
      this.updateStructureVisual(object, structure);
    }

    for (const [id, object] of this.structureMeshes) {
      if (!nextIds.has(id)) {
        this.scene.remove(object);
        this.structureMeshes.delete(id);
      }
    }
  }

  private syncOverlays(snapshot: SessionSnapshot) {
    this.cursorMarker.visible = snapshot.hud.pointerActive;
    this.cursorMarker.position.set(snapshot.hud.cursorX, CURSOR_RING_Y, snapshot.hud.cursorZ);

    const buildType = snapshot.localPlayer.selectedBuild;
    if (buildType && snapshot.hud.pointerActive) {
      this.buildPreview.visible = true;
      this.updatePreviewGeometry(buildType);
      this.buildPreview.position.set(
        snapshot.hud.cursorX,
        buildType === "wall" ? 1.5 : 0.8,
        snapshot.hud.cursorZ
      );
      this.buildPreviewMaterial.color.set(
        snapshot.hud.buildPreviewValid ? "#7be4ff" : "#ff9f80"
      );
      this.buildPreviewMaterial.emissive.set(
        snapshot.hud.buildPreviewValid ? "#7be4ff" : "#ff8f7a"
      );
    } else {
      this.buildPreview.visible = false;
    }

    this.whiteoutRing.visible = snapshot.match.phase !== "standard";
    this.whiteoutRing.scale.setScalar(snapshot.match.whiteoutRadius);

    this.bonfireGroup.visible = snapshot.hud.activeBonfire;
    this.bonfireLight.intensity = snapshot.hud.activeBonfire ? 4 : 0;
  }

  private createRunner(isLocal: boolean) {
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

  private animateRunner(
    runner: RunnerParts,
    snowLoad: number,
    buildCooldownRemaining: number
  ) {
    const elapsed = this.clock.elapsedTime;
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

  private createStructureMesh(structure: SessionStructureSnapshot) {
    if (structure.type === "wall") {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          SOLO_WALL_HALF_WIDTH * 2,
          3,
          SOLO_WALL_HALF_DEPTH * 2
        ),
        new THREE.MeshStandardMaterial({
          color: "#79e1ff",
          emissive: "#7be4ff",
          emissiveIntensity: 0.3,
          metalness: 0.05,
          roughness: 0.42
        })
      );
      mesh.position.y = 1.5;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    if (structure.type === "snowman_turret") {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 16, 16),
        new THREE.MeshStandardMaterial({
          color: "#f8fcff",
          emissive: "#99e5ff",
          emissiveIntensity: 0.32
        })
      );
      body.position.y = 0.9;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 12),
        new THREE.MeshStandardMaterial({ color: "#ffffff" })
      );
      head.position.y = 1.95;
      group.add(head);
      return group;
    }

    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(
        SOLO_STRUCTURE_COLLISION_RADIUS * 0.7,
        SOLO_STRUCTURE_COLLISION_RADIUS * 1.05,
        1,
        12
      ),
      new THREE.MeshStandardMaterial({
        color: "#ffcf73",
        emissive: "#ff914f",
        emissiveIntensity: 0.65
      })
    );
    base.position.y = 0.6;
    group.add(base);
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(
        SOLO_HEATER_BEACON_RADIUS - 0.18,
        SOLO_HEATER_BEACON_RADIUS,
        48
      ),
      new THREE.MeshBasicMaterial({
        color: "#ffd884",
        opacity: 0.55,
        side: THREE.DoubleSide,
        transparent: true
      })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    group.add(aura);
    return group;
  }

  private updatePreviewGeometry(buildType: BuildType) {
    this.buildPreview.geometry.dispose();

    if (buildType === "wall") {
      this.buildPreview.geometry = new THREE.BoxGeometry(
        SOLO_WALL_HALF_WIDTH * 2,
        3,
        SOLO_WALL_HALF_DEPTH * 2
      );
      return;
    }

    if (buildType === "snowman_turret") {
      this.buildPreview.geometry = new THREE.CylinderGeometry(0.9, 1.2, 2.4, 12);
      return;
    }

    this.buildPreview.geometry = new THREE.CylinderGeometry(1, 1.4, 1.2, 16);
  }

  private updateStructureVisual(
    object: THREE.Object3D,
    structure: SessionStructureSnapshot
  ) {
    const maxHp = getStructureMaxHp(structure.type);
    const ratio = Math.max(0.25, structure.hp / maxHp);

    object.scale.y = ratio;

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const material = child.material;
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        return;
      }

      material.emissiveIntensity =
        structure.type === "heater_beacon" ? 0.45 + (1 - ratio) * 0.2 : 0.25 + (1 - ratio) * 0.3;
    });
  }

  private readonly handleResize = () => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
