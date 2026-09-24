import { Group, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  attachLemonadeCupToHand,
  createCupInventory,
  decorateLemonadeCup,
  MAX_VISIBLE_PREPARED_CUPS,
  visibleCupCountForStock,
} from "../src/cup-inventory.js";
import { STAND_LAYOUT, standCounterBounds } from "../src/stand-layout.js";

describe("original-art 3D lemonade cups", () => {
  it("uses layered glass, lemonade, five ice cubes, and a straw for held cups", () => {
    const cup = new Group();
    decorateLemonadeCup(cup);

    expect(cup.children).toHaveLength(9);
  });

  it("anchors a carried cup directly to the hand without a floating forearm offset", () => {
    const arm = new Group();
    const hand = new Group();
    hand.position.set(0, -0.34, 0);
    arm.add(hand);

    const cup = new Group();
    attachLemonadeCupToHand(hand, cup);

    expect(cup.parent).toBe(hand);
    expect(cup.position.length()).toBeLessThan(0.15);
    expect(cup.position.z).toBeGreaterThan(0);
    expect(cup.scale.x).toBeCloseTo(0.9);

    arm.rotation.x = -1.1;
    arm.rotation.z = 0.35;
    arm.updateMatrixWorld(true);

    const handWorld = hand.getWorldPosition(new Vector3());
    const cupWorld = cup.getWorldPosition(new Vector3());
    expect(handWorld.distanceTo(cupWorld)).toBeCloseTo(cup.position.length());
  });

  it("keeps prepared cups visibly stacked on the vendor's right side", () => {
    const inventory = createCupInventory();

    expect(inventory.meshes).toHaveLength(9);
    inventory.setStock(37, 37);
    expect(inventory.meshes.every((mesh) => mesh.count === 37)).toBe(true);

    const firstCup = new Matrix4();
    inventory.meshes[0]?.getMatrixAt(0, firstCup);
    const position = new Vector3().setFromMatrixPosition(firstCup);
    const bounds = standCounterBounds();

    expect(position.y).toBeCloseTo(STAND_LAYOUT.cupCenterY);
    expect(position.x).toBeGreaterThan(STAND_LAYOUT.sellerSightline.maxX);
    expect(position.x).toBeGreaterThan(bounds.minX);
    expect(position.x).toBeLessThan(bounds.maxX);
    expect(position.z).toBeGreaterThan(bounds.minZ);
    expect(position.z).toBeLessThan(bounds.maxZ);

    const topCup = new Matrix4();
    inventory.meshes[0]?.getMatrixAt(MAX_VISIBLE_PREPARED_CUPS - 1, topCup);
    const topPosition = new Vector3().setFromMatrixPosition(topCup);
    expect(topPosition.y).toBeGreaterThan(position.y);
    expect(topPosition.x).toBeGreaterThan(STAND_LAYOUT.sellerSightline.maxX);

    inventory.setStock(0, 37);
    expect(inventory.meshes.every((mesh) => mesh.count === 0)).toBe(true);
  });

  it("compresses high-level inventory into a proportional compact stack", () => {
    expect(visibleCupCountForStock(15, 15)).toBe(15);
    expect(visibleCupCountForStock(400, 400)).toBe(MAX_VISIBLE_PREPARED_CUPS);
    expect(visibleCupCountForStock(200, 400)).toBe(MAX_VISIBLE_PREPARED_CUPS / 2);
    expect(visibleCupCountForStock(0, 400)).toBe(0);
  });
});
