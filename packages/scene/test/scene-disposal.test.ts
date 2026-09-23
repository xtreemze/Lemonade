import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import { describe, expect, it } from "vitest";

import { disposeSceneResources } from "../src/scene-disposal.js";

describe("scene resource disposal", () => {
  it("disposes shared geometry and materials only once", () => {
    const root = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial();
    let geometryDisposals = 0;
    let materialDisposals = 0;
    geometry.addEventListener("dispose", () => {
      geometryDisposals += 1;
    });
    material.addEventListener("dispose", () => {
      materialDisposals += 1;
    });

    root.add(new Mesh(geometry, material), new Mesh(geometry, material));

    expect(disposeSceneResources(root)).toEqual({
      geometries: 1,
      materials: 1,
    });
    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
  });
});
