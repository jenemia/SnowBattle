import * as THREE from "three";

import {
  getWallStructureRotationY,
  SOLO_WALL_HALF_DEPTH,
  SOLO_WALL_HALF_WIDTH,
  type BuildType,
  type SessionSnapshot
} from "@snowbattle/shared";

const CURSOR_RING_Y = 0.03;
const PREVIEW_ALPHA = 0.38;
const BUILDING_GROUND_CLEARANCE = 0.03;

export class SoloOverlayRenderer {
  private readonly buildPreview: THREE.Mesh;
  private readonly buildPreviewGeometries: Record<BuildType, THREE.BufferGeometry>;
  private readonly buildPreviewMaterial: THREE.MeshStandardMaterial;
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
    this.buildPreviewGeometries = {
      heater_beacon: new THREE.CylinderGeometry(1, 1.4, 1.2, 16),
      snowman_turret: new THREE.CylinderGeometry(0.9, 1.2, 2.4, 12),
      wall: new THREE.BoxGeometry(SOLO_WALL_HALF_WIDTH * 2, 3, SOLO_WALL_HALF_DEPTH * 2)
    };
    this.buildPreview = new THREE.Mesh(
      this.buildPreviewGeometries.wall,
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
  }

  sync(snapshot: SessionSnapshot) {
    this.cursorMarker.visible = snapshot.hud.pointerActive;
    this.cursorMarker.position.set(snapshot.hud.cursorX, CURSOR_RING_Y, snapshot.hud.cursorZ);

    const buildType = snapshot.localPlayer.selectedBuild;
    if (buildType && snapshot.hud.pointerActive) {
      this.buildPreview.visible = true;
      this.buildPreview.geometry = this.buildPreviewGeometries[buildType];
      this.buildPreview.position.set(
        snapshot.hud.cursorX,
        getBuildPreviewCenterY(buildType),
        snapshot.hud.cursorZ
      );
      this.buildPreview.rotation.y =
        buildType === "wall"
          ? getWallPreviewYaw(snapshot)
          : 0;
      this.buildPreviewMaterial.color.set(
        snapshot.hud.buildPreviewValid ? "#7be4ff" : "#ff9f80"
      );
      this.buildPreviewMaterial.emissive.set(
        snapshot.hud.buildPreviewValid ? "#7be4ff" : "#ff8f7a"
      );
    } else {
      this.buildPreview.visible = false;
      this.buildPreview.rotation.y = 0;
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

export function getBuildPreviewCenterY(buildType: BuildType) {
  if (buildType === "wall") {
    return 1.5 + BUILDING_GROUND_CLEARANCE;
  }

  if (buildType === "snowman_turret") {
    return 1.2 + BUILDING_GROUND_CLEARANCE;
  }

  return 0.6 + BUILDING_GROUND_CLEARANCE;
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
