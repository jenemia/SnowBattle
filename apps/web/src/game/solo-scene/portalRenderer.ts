import * as THREE from "three";

import {
  EXIT_PORTAL_POSITION,
  RETURN_PORTAL_POSITION
} from "../../routes/solo-page/portalHelpers";

export interface SoloScenePortalOptions {
  showExitPortal: boolean;
  showReturnPortal: boolean;
}

export class SoloPortalRenderer {
  private readonly exitPortal = createPortalGroup("#7be4ff", "#dbffff");
  private readonly returnPortal = createPortalGroup("#9dff7a", "#ecffd8");
  private readonly enabled: boolean;

  constructor(scene: THREE.Scene, options: SoloScenePortalOptions) {
    this.enabled = options.showExitPortal || options.showReturnPortal;
    this.exitPortal.position.set(EXIT_PORTAL_POSITION.x, 0, EXIT_PORTAL_POSITION.z);
    this.returnPortal.position.set(RETURN_PORTAL_POSITION.x, 0, RETURN_PORTAL_POSITION.z);

    if (this.enabled) {
      scene.add(this.exitPortal);
      scene.add(this.returnPortal);
    }

    this.setVisibility(options);
  }

  setVisibility(options: SoloScenePortalOptions) {
    if (!this.enabled) {
      return;
    }

    this.exitPortal.visible = options.showExitPortal;
    this.returnPortal.visible = options.showReturnPortal;
  }

  animate(delta: number) {
    if (!this.enabled) {
      return;
    }

    animatePortal(this.exitPortal, delta, 1);
    animatePortal(this.returnPortal, delta, -1);
  }
}

function createPortalGroup(ringColor: string, glowColor: string) {
  const group = new THREE.Group();

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.9, 0.45, 24),
    new THREE.MeshStandardMaterial({
      color: "#123042",
      emissive: "#0a2332",
      roughness: 0.5
    })
  );
  pedestal.position.y = 0.22;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.14, 10, 48),
    new THREE.MeshStandardMaterial({
      color: ringColor,
      emissive: glowColor,
      emissiveIntensity: 0.8,
      roughness: 0.24
    })
  );
  ring.position.y = 1.35;
  ring.rotation.y = Math.PI / 2;
  ring.castShadow = true;
  group.add(ring);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 32),
    new THREE.MeshBasicMaterial({
      color: glowColor,
      opacity: 0.42,
      side: THREE.DoubleSide,
      transparent: true
    })
  );
  halo.position.y = 1.35;
  halo.rotation.y = Math.PI / 2;
  group.add(halo);

  const spark = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({
      color: glowColor,
      opacity: 0.7,
      transparent: true
    })
  );
  spark.position.y = 1.35;
  spark.rotation.x = Math.PI / 2;
  group.add(spark);

  const label = createPortalLabelSprite("Vibe Jam Portal", glowColor);
  label.position.set(0, 3.05, 0);
  group.add(label);

  return group;
}

function animatePortal(group: THREE.Group, delta: number, direction: number) {
  if (!group.visible) {
    return;
  }

  const ring = group.children[1];
  const halo = group.children[2];
  const spark = group.children[3];
  const label = group.children[4] as THREE.Sprite;

  ring.rotation.z += delta * 1.25 * direction;
  halo.rotation.z -= delta * 0.45 * direction;
  spark.rotation.y += delta * 1.8;
  halo.position.y = 1.35 + Math.sin(performance.now() / 240) * 0.05;
  label.position.y = 3.05 + Math.sin(performance.now() / 320) * 0.04;
}

function createPortalLabelSprite(text: string, glowColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create portal label context");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(4, 14, 24, 0.72)";
  roundRect(context, 10, 18, 492, 92, 28);
  context.fill();
  context.strokeStyle = "rgba(219, 255, 255, 0.42)";
  context.lineWidth = 4;
  roundRect(context, 10, 18, 492, 92, 28);
  context.stroke();
  context.font = '700 38px "Instrument Sans", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = glowColor;
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    })
  );
  sprite.scale.set(4.8, 1.2, 1);
  return sprite;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
