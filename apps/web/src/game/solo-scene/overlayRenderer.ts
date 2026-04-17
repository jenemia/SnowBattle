import * as THREE from "three";

import {
  getWallStructureRotationY,
  SOLO_HEATER_BEACON_RADIUS,
  SOLO_WALL_HALF_DEPTH,
  SOLO_WALL_HALF_WIDTH,
  type BuildType,
  type SessionSnapshot
} from "@snowbattle/shared";

const CURSOR_RING_Y = 0.03;
const PREVIEW_ALPHA = 0.38;
const BUILDING_GROUND_CLEARANCE = 0.03;
const TURRET_GROUND_CLEARANCE = 0.34;

export class SoloOverlayRenderer {
  private readonly buildPreviewMaterial: THREE.MeshStandardMaterial;
  private readonly buildPreviews: Record<BuildType, THREE.Object3D>;
  private activeBuildPreview: THREE.Object3D | null = null;
  private readonly cursorMarker: THREE.Mesh;
  private readonly bonfireGroup: THREE.Group;
  private readonly bonfireLight: THREE.PointLight;
  private readonly whiteoutRing: THREE.Mesh;

  constructor(private readonly scene: THREE.Scene) {
    this.cursorMarker = createCursorMarker();
    this.scene.add(this.cursorMarker);

    this.buildPreviewMaterial = new THREE.MeshStandardMaterial({
      color: "#7be4ff",
      emissive: "#7be4ff",
      emissiveIntensity: 0.3,
      opacity: PREVIEW_ALPHA,
      roughness: 0.35,
      transparent: true
    });
    this.buildPreviews = {
      heater_beacon: createHeaterPreview(this.buildPreviewMaterial),
      snowman_turret: createTurretPreview(this.buildPreviewMaterial),
      wall: createWallPreview(this.buildPreviewMaterial)
    };
    for (const preview of Object.values(this.buildPreviews)) {
      preview.visible = false;
      this.scene.add(preview);
    }

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
  }

  sync(snapshot: SessionSnapshot) {
    this.cursorMarker.visible = snapshot.hud.pointerActive;
    this.cursorMarker.position.set(snapshot.hud.cursorX, CURSOR_RING_Y, snapshot.hud.cursorZ);

    const buildType = snapshot.localPlayer.selectedBuild;
    if (buildType && snapshot.hud.pointerActive) {
      const preview = this.buildPreviews[buildType];

      if (this.activeBuildPreview && this.activeBuildPreview !== preview) {
        this.activeBuildPreview.visible = false;
        this.activeBuildPreview.rotation.y = 0;
      }

      this.activeBuildPreview = preview;
      preview.visible = true;
      preview.position.set(
        snapshot.hud.cursorX,
        0,
        snapshot.hud.cursorZ
      );
      preview.rotation.y =
        buildType === "wall"
          ? getWallPreviewYaw(snapshot)
          : 0;
      applyPreviewTone(preview, snapshot.hud.buildPreviewValid);
    } else {
      if (this.activeBuildPreview) {
        this.activeBuildPreview.visible = false;
        this.activeBuildPreview.rotation.y = 0;
        this.activeBuildPreview = null;
      }
    }

    this.whiteoutRing.visible = snapshot.match.phase !== "standard";
    this.whiteoutRing.scale.setScalar(snapshot.match.whiteoutRadius);

    this.bonfireGroup.visible = snapshot.hud.activeBonfire;
    this.bonfireLight.intensity = snapshot.hud.activeBonfire ? 4 : 0;
  }
}

export function getWallPreviewYaw(snapshot: SessionSnapshot) {
  return getWallStructureRotationY(
    snapshot.localPlayer.x,
    snapshot.localPlayer.z,
    snapshot.hud.cursorX,
    snapshot.hud.cursorZ
  );
}

function createCursorMarker() {
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

function createWallPreview(material: THREE.MeshStandardMaterial) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(SOLO_WALL_HALF_WIDTH * 2, 3, SOLO_WALL_HALF_DEPTH * 2),
    material
  );
  mesh.position.y = 1.5 + BUILDING_GROUND_CLEARANCE;
  group.add(mesh);
  return group;
}

function createTurretPreview(material: THREE.MeshStandardMaterial) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), material);
  body.position.y = 0.8 + TURRET_GROUND_CLEARANCE;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), material);
  head.position.y = 1.85 + TURRET_GROUND_CLEARANCE;
  group.add(head);
  return group;
}

function createHeaterPreview(material: THREE.MeshStandardMaterial) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 1.2, 16), material);
  base.position.y = 0.6 + BUILDING_GROUND_CLEARANCE;
  group.add(base);

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(
      SOLO_HEATER_BEACON_RADIUS - 0.18,
      SOLO_HEATER_BEACON_RADIUS,
      48
    ),
    material
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.04 + BUILDING_GROUND_CLEARANCE;
  group.add(aura);
  return group;
}

function applyPreviewTone(preview: THREE.Object3D, isValid: boolean) {
  preview.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const material = child.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) {
      return;
    }

    material.color.set(isValid ? "#7be4ff" : "#ff9f80");
    material.emissive.set(isValid ? "#7be4ff" : "#ff8f7a");
  });
}
