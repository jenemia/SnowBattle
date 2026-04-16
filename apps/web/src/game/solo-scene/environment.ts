import * as THREE from "three";

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
    scene.add(marker);
  }
}
