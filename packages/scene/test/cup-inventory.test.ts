import { describe, expect, it } from "vitest";
import { Group, Matrix4, Vector3 } from "three";

import { createCupInventory, decorateLemonadeCup } from "../src/cup-inventory.js";
import { STAND_LAYOUT, standCounterBounds } from "../src/stand-layout.js";

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

    const firstCup = new Matrix4();
    inventory.meshes[0]?.getMatrixAt(0, firstCup);
    const position = new Vector3().setFromMatrixPosition(firstCup);
    const bounds = standCounterBounds();
    expect(position.y).toBeCloseTo(STAND_LAYOUT.cupCenterY);
    expect(position.x).toBeGreaterThan(bounds.minX);
    expect(position.x).toBeLessThan(bounds.maxX);
    expect(position.z).toBeGreaterThan(bounds.minZ);
    expect(position.z).toBeLessThan(bounds.maxZ);

    inventory.setCount(0);
    expect(inventory.meshes.every((mesh) => mesh.count === 0)).toBe(true);
  });
});
