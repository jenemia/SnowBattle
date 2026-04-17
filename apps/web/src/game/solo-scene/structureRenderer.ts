import * as THREE from "three";

import {
  SOLO_HEATER_BEACON_HP,
  SOLO_HEATER_BEACON_RADIUS,
  SOLO_SNOWMAN_TURRET_HP,
  SOLO_STRUCTURE_COLLISION_RADIUS,
  SOLO_WALL_HALF_DEPTH,
  SOLO_WALL_HALF_WIDTH,
  SOLO_WALL_HP,
  type BuildType,
  type SessionSnapshot,
  type SessionStructureSnapshot
} from "@snowbattle/shared";

export class SoloStructureRenderer {
  private readonly structureMeshes = new Map<string, THREE.Object3D>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(snapshot: SessionSnapshot) {
    const nextIds = new Set(snapshot.structures.map((structure) => structure.id));

    for (const structure of snapshot.structures) {
      let object = this.structureMeshes.get(structure.id);

      if (!object) {
        object = createStructureMesh(structure);
        this.structureMeshes.set(structure.id, object);
        this.scene.add(object);
      }

      object.position.set(structure.x, 0, structure.z);
      object.rotation.y = structure.rotationY ?? 0;
      object.visible = structure.enabled;
      updateStructureVisual(object, structure);
    }

    for (const [id, object] of this.structureMeshes) {
      if (!nextIds.has(id)) {
        this.scene.remove(object);
        this.structureMeshes.delete(id);
      }
    }
  }
}

function createStructureMesh(structure: SessionStructureSnapshot) {
  if (structure.type === "wall") {
    return createGroundAnchoredWall();
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

export function createGroundAnchoredWall() {
  const group = new THREE.Group();
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
  group.add(mesh);
  return group;
}

function updateStructureVisual(
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

function getStructureMaxHp(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_HP;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_HP;
  }

  return SOLO_HEATER_BEACON_HP;
}
