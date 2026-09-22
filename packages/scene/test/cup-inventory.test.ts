import { describe, expect, it } from "vitest";
import { Group } from "three";

import { createCupInventory, decorateLemonadeCup } from "../src/cup-inventory.js";

describe("original-art 3D lemonade cups", () => {
  it("uses layered glass, lemonade, five ice cubes, and a straw for held cups", () => {
    const cup = new Group();
    decorateLemonadeCup(cup);

    expect(cup.children).toHaveLength(9);
  });

  it("keeps prepared-cup inventory fully three-dimensional and count-driven", () => {
    const inventory = createCupInventory();

    expect(inventory.meshes).toHaveLength(9);
    inventory.setCount(37);
    expect(inventory.meshes.every((mesh) => mesh.count === 37)).toBe(true);

    inventory.setCount(0);
    expect(inventory.meshes.every((mesh) => mesh.count === 0)).toBe(true);
  });
});
