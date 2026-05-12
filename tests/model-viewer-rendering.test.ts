import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { prepareLoadedStlPreview } from "../src/components/ModelViewer.tsx";

describe("model viewer STL rendering", () => {
  it("renders loaded STL previews as geometry-only meshes", () => {
    const geometry = new THREE.BoxGeometry(2, 1, 1);
    const group = new THREE.Group();
    const mainMaterial = new THREE.MeshStandardMaterial({ color: "#c7352f" });

    prepareLoadedStlPreview(group, geometry, mainMaterial);

    const meshes = group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    assert.equal(meshes.length, 1);
    assert.equal(meshes[0].material, mainMaterial);
    assert.notEqual(meshes[0].userData.role, "accent-preview-overlay");
  });

  it("places the loaded STL above the preview floor", () => {
    const geometry = new THREE.BoxGeometry(2, 4, 1);
    geometry.translate(0, -5, 0);
    const group = new THREE.Group();

    prepareLoadedStlPreview(
      group,
      geometry,
      new THREE.MeshStandardMaterial({ color: "#c7352f" })
    );

    const bounds = new THREE.Box3().setFromObject(group);
    assert.ok(bounds.min.y >= -0.581, `expected min y to sit on the floor, got ${bounds.min.y}`);
  });
});
