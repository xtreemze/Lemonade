import { describe, expect, it } from "vitest";
import { Group, Scene } from "three";

import { snapshotSceneTree } from "../src/devtools.js";

describe("scene devtools", () => {
  it("creates a bounded tree with stable ids", () => {
    const scene = new Scene();
    const group = new Group();
    group.name = "neighborhood";
    const child = new Group();
    child.name = "house";
    group.add(child);
    scene.add(group);

    const tree = snapshotSceneTree(scene, { maxDepth: 1, maxChildren: 10 });

    expect(tree.id).toBe(scene.uuid);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]?.name).toBe("neighborhood");
    expect(tree.children[0]?.childCount).toBe(1);
    expect(tree.children[0]?.children).toEqual([]);
    expect(tree.children[0]?.childrenTruncated).toBe(true);
  });

  it("marks a parent truncated when maxChildren is reached", () => {
    const scene = new Scene();
    for (let index = 0; index < 3; index += 1) {
      const group = new Group();
      group.name = `group-${String(index)}`;
      scene.add(group);
    }

    const tree = snapshotSceneTree(scene, { maxDepth: 2, maxChildren: 2 });

    expect(tree.children).toHaveLength(2);
    expect(tree.childrenTruncated).toBe(true);
  });
});
