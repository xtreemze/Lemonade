import { Group, Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  applyObjectTransform,
  captureObjectTransform,
  indexSceneEditorObjects,
  sceneEditorObjectKey,
} from "../src/gizmo-controller.js";

describe("3d editor semantic object transforms", () => {
  it("uses stable names and semantic property roles instead of Three.js UUIDs", () => {
    const scene = new Scene();

    const named = new Group();
    named.name = "building-stand-home";
    scene.add(named);

    const door = new Group();
    door.userData["sceneRole"] = "house-door";
    door.userData["propertyRole"] = "stand-home";
    scene.add(door);

    expect(sceneEditorObjectKey(scene, named)).toBe("name:building-stand-home");
    expect(sceneEditorObjectKey(scene, door)).toBe(
      "role:house-door:property:stand-home",
    );

    const key = sceneEditorObjectKey(scene, named);
    expect(key).toBe("name:building-stand-home");
    expect(key).not.toContain(named.uuid);
  });

  it("captures, reapplies, and indexes transforms by semantic key", () => {
    const scene = new Scene();
    const object = new Group();
    object.name = "seller";
    object.position.set(1, 2, 3);
    object.rotation.set(0.1, 0.2, 0.3);
    object.scale.set(1.1, 1.2, 1.3);
    scene.add(object);

    const captured = captureObjectTransform(scene, object);
    object.position.set(9, 9, 9);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);

    applyObjectTransform(object, captured);

    expect(object.position.toArray()).toEqual([1, 2, 3]);
    expect(object.rotation.x).toBeCloseTo(0.1);
    expect(object.rotation.y).toBeCloseTo(0.2);
    expect(object.rotation.z).toBeCloseTo(0.3);
    expect(object.scale.toArray()).toEqual([1.1, 1.2, 1.3]);
    expect(indexSceneEditorObjects(scene).get("name:seller")).toBe(object);
  });

  it("disambiguates repeated role-only objects deterministically", () => {
    const scene = new Scene();
    const first = new Group();
    const second = new Group();
    first.userData["sceneRole"] = "procedural-tree";
    second.userData["sceneRole"] = "procedural-tree";
    scene.add(first, second);

    expect(sceneEditorObjectKey(scene, first)).toBe("role:procedural-tree:0");
    expect(sceneEditorObjectKey(scene, second)).toBe("role:procedural-tree:1");
  });
});
