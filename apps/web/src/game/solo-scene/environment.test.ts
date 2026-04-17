import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { STATIC_ARENA_OBSTACLES } from "@snowbattle/shared";

import { buildSoloEnvironment } from "./environment";

describe("buildSoloEnvironment", () => {
  it("does not add the old low-poly marker meshes", () => {
    const scene = new THREE.Scene();

    buildSoloEnvironment(scene);

    expect(
      scene.children.some(
        (child) =>
          child instanceof THREE.Mesh &&
          child.geometry instanceof THREE.CylinderGeometry
      )
    ).toBe(false);
  });

  it("adds the static obstacle root with one anchor per configured obstacle", () => {
    const scene = new THREE.Scene();

    buildSoloEnvironment(scene);

    const obstacleRoot = scene.getObjectByName("holiday-static-obstacles");

    expect(obstacleRoot).toBeInstanceOf(THREE.Group);
    expect(obstacleRoot?.children).toHaveLength(STATIC_ARENA_OBSTACLES.length);
  });
});
