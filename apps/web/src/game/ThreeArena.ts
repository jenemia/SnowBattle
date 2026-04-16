import * as THREE from "three";

import {
  ARENA_HALF_EXTENT,
  type SessionPlayerSnapshot,
  type SessionProjectileSnapshot,
  type SessionSnapshot,
  type SlotId
} from "@snowbattle/shared";

export class ThreeArena {
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  private readonly playerMeshes = new Map<SlotId, THREE.Group>();
  private readonly projectileMeshes = new Map<string, THREE.Mesh>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly screenNdc = new THREE.Vector2();
  private snapshot: SessionSnapshot | null = null;
  private running = false;

  constructor(private readonly mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.mount.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2("#07111b", 0.03);
    this.buildScene();
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  applySnapshot(snapshot: SessionSnapshot) {
    this.snapshot = snapshot;
    this.syncPlayers([snapshot.localPlayer, snapshot.opponentPlayer]);
    this.syncProjectiles(snapshot.projectiles);
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

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.renderer.setAnimationLoop(() => {
      this.render();
    });
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    this.renderer.setAnimationLoop(null);
    this.mount.removeChild(this.renderer.domElement);
  }

  private buildScene() {
    this.scene.add(new THREE.AmbientLight("#b6efff", 0.8));

    const keyLight = new THREE.DirectionalLight("#ffffff", 1.65);
    keyLight.position.set(12, 18, 8);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight("#7be4ff", 15, 60, 2);
    rimLight.position.set(-10, 12, -4);
    this.scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(26, 80),
      new THREE.MeshStandardMaterial({
        color: "#d9f6ff",
        metalness: 0.08,
        roughness: 0.82
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(26, 0.24, 12, 120),
      new THREE.MeshBasicMaterial({ color: "#8ee4ff" })
    );
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);

    const grid = new THREE.GridHelper(44, 22, "#7be4ff", "#244052");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.28;
    this.scene.add(grid);
  }

  private syncPlayers(players: SessionPlayerSnapshot[]) {
    const nextIds = new Set(players.map((player) => player.slot));

    for (const player of players) {
      let group = this.playerMeshes.get(player.slot);

      if (!group) {
        group = this.createPlayerMesh(player);
        this.playerMeshes.set(player.slot, group);
        this.scene.add(group);
      }

      group.position.set(player.x, 0.65, player.z);
      group.rotation.y = -player.facingAngle;

      const body = group.children[0] as THREE.Mesh;
      const head = group.children[1] as THREE.Mesh;
      const emissiveColor = player.slot === "A" ? "#73e0ff" : "#ffd2f7";
      const material = body.material as THREE.MeshStandardMaterial;
      material.emissive.set(player.connected ? emissiveColor : "#3a4b59");
      const headMaterial = head.material as THREE.MeshStandardMaterial;
      headMaterial.color.set(player.ready ? "#f4ffff" : "#8ea9b8");
    }

    for (const [slot, mesh] of this.playerMeshes) {
      if (!nextIds.has(slot)) {
        this.scene.remove(mesh);
        this.playerMeshes.delete(slot);
      }
    }
  }

  private syncProjectiles(projectiles: SessionProjectileSnapshot[]) {
    const nextIds = new Set(projectiles.map((projectile) => projectile.id));

    for (const projectile of projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);

      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 16, 16),
          new THREE.MeshStandardMaterial({
            color: projectile.ownerSlot === "A" ? "#73e0ff" : "#ffc0f0",
            emissive: projectile.ownerSlot === "A" ? "#73e0ff" : "#ffc0f0",
            emissiveIntensity: 0.85
          })
        );
        this.projectileMeshes.set(projectile.id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(projectile.x, 0.7, projectile.z);
    }

    for (const [projectileId, mesh] of this.projectileMeshes) {
      if (!nextIds.has(projectileId)) {
        this.scene.remove(mesh);
        this.projectileMeshes.delete(projectileId);
      }
    }
  }

  private createPlayerMesh(player: SessionPlayerSnapshot) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.1, 1.2, 16),
      new THREE.MeshStandardMaterial({
        color: player.slot === "A" ? "#12344a" : "#3b2048",
        emissive: player.slot === "A" ? "#73e0ff" : "#ffd2f7",
        emissiveIntensity: 0.65,
        metalness: 0.1,
        roughness: 0.45
      })
    );
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 18, 18),
      new THREE.MeshStandardMaterial({ color: "#f4ffff" })
    );
    head.position.set(0, 0.95, 0);
    head.castShadow = true;
    group.add(head);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: "#ffb28c" })
    );
    nose.position.set(0, 0.95, 0.56);
    nose.rotation.x = Math.PI / 2;
    group.add(nose);

    return group;
  }

  private render() {
    const snapshot = this.snapshot;

    if (snapshot) {
      const focusPlayer = snapshot.localPlayer;
      const idealPosition = new THREE.Vector3(focusPlayer.x, 22, focusPlayer.z + 15);
      this.camera.position.lerp(idealPosition, 0.08);
      this.camera.lookAt(focusPlayer.x, 0, focusPlayer.z);
    }

    this.renderer.render(this.scene, this.camera);
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
