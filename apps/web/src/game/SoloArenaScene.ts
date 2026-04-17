import * as THREE from "three";

import type { SessionSnapshot } from "@snowbattle/shared";

import {
  buildSoloEnvironment,
  SoloOverlayRenderer,
  SoloPlayerRenderer,
  SoloProjectileRenderer,
  SoloSceneCameraController,
  SoloStructureRenderer
} from "./solo-scene";

export class SoloArenaScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly clock = new THREE.Clock();
  private readonly cameraController = new SoloSceneCameraController();
  private readonly playerRenderer: SoloPlayerRenderer;
  private readonly projectileRenderer: SoloProjectileRenderer;
  private readonly structureRenderer: SoloStructureRenderer;
  private readonly overlayRenderer: SoloOverlayRenderer;
  private readonly resizeObserver: ResizeObserver | null;
  private latestSnapshot: SessionSnapshot | null = null;
  private running = false;

  constructor(private readonly mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.mount.appendChild(this.renderer.domElement);

    buildSoloEnvironment(this.scene);
    this.playerRenderer = new SoloPlayerRenderer(this.scene, this.clock);
    this.projectileRenderer = new SoloProjectileRenderer(this.scene);
    this.structureRenderer = new SoloStructureRenderer(this.scene);
    this.overlayRenderer = new SoloOverlayRenderer(this.scene);

    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            this.handleResize();
          });
    this.resizeObserver?.observe(this.mount);
    this.resizeObserver?.observe(this.renderer.domElement);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("scroll", this.handleViewportBoundsChange, true);
    window.visualViewport?.addEventListener("resize", this.handleViewportBoundsChange);
    window.visualViewport?.addEventListener("scroll", this.handleViewportBoundsChange);
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
    window.removeEventListener("scroll", this.handleViewportBoundsChange, true);
    window.visualViewport?.removeEventListener("resize", this.handleViewportBoundsChange);
    window.visualViewport?.removeEventListener("scroll", this.handleViewportBoundsChange);
    this.resizeObserver?.disconnect();
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.mount.removeChild(this.renderer.domElement);
  }

  render(snapshot: SessionSnapshot) {
    this.latestSnapshot = snapshot;
    this.playerRenderer.sync(snapshot);
    this.projectileRenderer.sync(snapshot);
    this.structureRenderer.sync(snapshot);
    this.overlayRenderer.sync(snapshot);
  }

  screenPointToWorld(clientX: number, clientY: number) {
    return this.cameraController.screenPointToWorld(clientX, clientY);
  }

  private renderFrame() {
    this.cameraController.update(this.latestSnapshot, this.clock.getDelta());

    this.renderer.render(this.scene, this.cameraController.camera);
  }

  private readonly handleResize = () => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    this.cameraController.resize(width, height);
    this.renderer.setSize(width, height, false);
    this.handleViewportBoundsChange();
  };

  private readonly handleViewportBoundsChange = () => {
    this.cameraController.setViewportBounds(this.renderer.domElement.getBoundingClientRect());
  };
}
