import { LOD, PerspectiveCamera, Scene } from "three";
import { describe, expect, it } from "vitest";
import { populateNeighborhood } from "../src/neighborhood.js";
import { DEFAULT_RESIDENTIAL_SEED } from "../src/residential-layout.js";

const distanceLodChild = (sceneRole: string, scene: Scene): LOD => {
  const root = scene.children.find((object) => object.userData["sceneRole"] === sceneRole);
  expect(root).toBeDefined();
  const lod = root?.children.find((child) => child instanceof LOD);
  expect(lod).toBeInstanceOf(LOD);
  if (!(lod instanceof LOD)) {
    throw new Error(`expected ${sceneRole} to contain a Three LOD`);
  }
  return lod;
};

describe("neighborhood distance LOD", () => {
  it("uses Three renderer-managed LOD for houses and procedural vegetation", () => {
    const scene = new Scene();
    populateNeighborhood(scene, DEFAULT_RESIDENTIAL_SEED);

    expect(distanceLodChild("stand-home", scene).levels).toHaveLength(2);
    expect(distanceLodChild("procedural-tree", scene).levels).toHaveLength(2);
    expect(distanceLodChild("procedural-shrub", scene).levels).toHaveLength(2);
  });

  it("switches the featured house between detailed and distant levels by camera distance", () => {
    const scene = new Scene();
    populateNeighborhood(scene, DEFAULT_RESIDENTIAL_SEED);
    const root = scene.children.find((object) => object.userData["sceneRole"] === "stand-home");
    expect(root).toBeDefined();
    if (root === undefined) {
      return;
    }

    const lod = distanceLodChild("stand-home", scene);
    const near = lod.levels[0]?.object;
    const far = lod.levels[1]?.object;
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    if (near === undefined || far === undefined) {
      return;
    }

    const camera = new PerspectiveCamera(45, 1, 0.1, 300);
    scene.updateMatrixWorld(true);

    camera.position.set(root.position.x, 5, root.position.z + 8);
    camera.updateMatrixWorld(true);
    lod.update(camera);
    expect(near.visible).toBe(true);
    expect(far.visible).toBe(false);

    camera.position.set(root.position.x, 5, root.position.z + 90);
    camera.updateMatrixWorld(true);
    lod.update(camera);
    expect(near.visible).toBe(false);
    expect(far.visible).toBe(true);
  });
});
