import * as THREE from "three";

import type { SessionSnapshot } from "@snowbattle/shared";

const PROJECTILE_RENDER_Y = 1.4;

export class SoloProjectileRenderer {
  private readonly projectileMeshes = new Map<string, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(snapshot: SessionSnapshot) {
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
}
