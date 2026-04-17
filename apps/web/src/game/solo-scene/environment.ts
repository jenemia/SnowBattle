import * as THREE from "three";

import { STATIC_ARENA_OBSTACLES } from "@snowbattle/shared";

import {
  createHolidayAssetFallback,
  createHolidayAssetInstance,
  fitHolidayAssetToGround
} from "./holidayKitAssets";

export function buildSoloEnvironment(scene: THREE.Scene) {
  scene.fog = new THREE.FogExp2("#07111b", 0.026);
  scene.add(new THREE.AmbientLight("#c1efff", 0.95));

  const sun = new THREE.DirectionalLight("#ffffff", 1.45);
  sun.position.set(12, 28, 10);
  sun.castShadow = true;
  scene.add(sun);

  const fill = new THREE.PointLight("#7be4ff", 18, 90, 2);
  fill.position.set(-14, 12, -6);
  scene.add(fill);

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
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(25.6, 0.36, 10, 120),
    new THREE.MeshStandardMaterial({
      color: "#8ee4ff",
      emissive: "#7be4ff",
      emissiveIntensity: 0.45
    })
  );
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  const grid = new THREE.GridHelper(44, 22, "#7be4ff", "#2f5268");
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.26;
  scene.add(grid);

  const obstacleRoot = new THREE.Group();
  obstacleRoot.name = "holiday-static-obstacles";
  scene.add(obstacleRoot);

  for (const obstacle of STATIC_ARENA_OBSTACLES) {
    const anchor = new THREE.Group();
    anchor.name = obstacle.id;
    anchor.position.set(obstacle.x, 0, obstacle.z);
    anchor.rotation.y = obstacle.rotationY;
    const fallback = fitHolidayAssetToGround(
      createHolidayAssetFallback(obstacle.modelKey),
      {
        groundClearance: 0.03,
        targetHeight: obstacle.visualHeight
      }
    );
    anchor.add(fallback);
    obstacleRoot.add(anchor);

    void createHolidayAssetInstance(obstacle.modelKey, {
      groundClearance: 0.03,
      targetHeight: obstacle.visualHeight
    }).then((model) => {
      if (!anchor.parent) {
        return;
      }

      anchor.clear();
      anchor.add(model);
    });
  }
}
