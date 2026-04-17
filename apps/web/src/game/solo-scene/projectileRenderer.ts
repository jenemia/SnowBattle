import * as THREE from "three";

import type { SessionSnapshot } from "@snowbattle/shared";

const PROJECTILE_RENDER_Y = 1.4;
const PLAYER_PROJECTILE_RADIUS = 0.28;
const TURRET_PROJECTILE_RADIUS = 0.42;

export class SoloProjectileRenderer {
  private readonly projectileMeshes = new Map<string, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(snapshot: SessionSnapshot) {
    const nextIds = new Set(snapshot.projectiles.map((projectile) => projectile.id));

    for (const projectile of snapshot.projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);

      if (!mesh) {
        const isTurretProjectile = projectile.sourceType === "snowman_turret";
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(
            isTurretProjectile ? TURRET_PROJECTILE_RADIUS : PLAYER_PROJECTILE_RADIUS,
            14,
            14
          ),
          new THREE.MeshStandardMaterial({
            color:
              projectile.sourceType === "snowman_turret"
                ? "#ffe89a"
                : projectile.ownerSlot === "A"
                  ? "#f4ffff"
                  : "#ffd6f7",
            emissive:
              projectile.sourceType === "snowman_turret"
                ? "#ffb45a"
                : projectile.ownerSlot === "A"
                  ? "#7be4ff"
                  : "#ff8cd6",
            emissiveIntensity: projectile.sourceType === "snowman_turret" ? 1.1 : 0.65,
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
