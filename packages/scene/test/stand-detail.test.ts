import { Box3, Group, Vector3 } from "three";
import type { Mesh } from "three";
import { describe, expect, it } from "vitest";

import {
  populateStand,
  STAND_SIGN_CENTER_Y,
  visibleLemonCountForStock,
} from "../src/stand-detail.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";
import { WORLD_SCALE } from "../src/world-scale.js";

describe("stand detail", () => {
  it("adds a handmade sign and counter dressing as one lazy detail group", () => {
    const root = new Group();
    const shutter = new Group();
    root.add(shutter);

    populateStand(root, shutter);

    expect(root.children.length).toBeGreaterThanOrEqual(7);
    expect(shutter.children).toHaveLength(2);
    const detail = root.children.find(
      (child) => child.userData["sceneRole"] === "stand-detail",
    );
    expect(detail).toBeDefined();
    expect(detail?.children.length).toBeGreaterThanOrEqual(10);
  });

  it("mounts the handmade sign above the canopy and vendor sightline", () => {
    const root = new Group();
    const shutter = new Group();
    root.add(shutter);
    populateStand(root, shutter);

    let signY: number | null = null;
    root.traverse((object) => {
      if (object.userData["sceneRole"] === "stand-sign") signY = object.position.y;
    });

    const canopyTop =
      STAND_LAYOUT.canopy.position[1] + STAND_LAYOUT.canopy.size[1] / 2;
    expect(signY).toBe(STAND_SIGN_CENTER_Y);
    expect(STAND_SIGN_CENTER_Y - 0.28).toBeGreaterThan(canopyTop + 0.08);
  });

  it("keeps realistically scaled stock lemons contained by the basket", () => {
    const root = new Group();
    const shutter = new Group();
    root.add(shutter);
    populateStand(root, shutter);
    root.updateMatrixWorld(true);

    let basket: Group | undefined;
    const lemons: Group[] = [];
    root.traverse((object) => {
      if (object.userData["sceneRole"] === "stand-basket") basket = object as Group;
      if (object.userData["sceneRole"] === "stand-stock-lemon") {
        lemons.push(object as Group);
      }
    });

    expect(basket).toBeDefined();
    expect(lemons).toHaveLength(8);
    if (basket === undefined) return;

    const basketBounds = new Box3().setFromObject(basket);
    for (const lemon of lemons) {
      expect(lemon.parent).toBe(basket);
      const world = new Vector3();
      lemon.getWorldPosition(world);
      expect(world.x).toBeGreaterThan(basketBounds.min.x);
      expect(world.x).toBeLessThan(basketBounds.max.x);
      expect(world.z).toBeGreaterThan(basketBounds.min.z);
      expect(world.z).toBeLessThan(basketBounds.max.z);
      expect(lemon.rotation.x).toBe(0);
      expect(lemon.rotation.y).toBe(0);
      expect(lemon.rotation.z).toBe(0);

      const lemonBounds = new Box3().setFromObject(lemon);
      expect(lemonBounds.max.x - lemonBounds.min.x)
        .toBeLessThanOrEqual(WORLD_SCALE.produce.lemonDiameter * 1.25);
    }
  });

  it("keeps pitcher and basket opposite the cup stack and out of the seller sightline", () => {
    const root = new Group();
    const shutter = new Group();
    root.add(shutter);
    populateStand(root, shutter);

    const roleObject = (role: string) => {
      let found: Group | Mesh | undefined;
      root.traverse((object) => {
        if (object.userData["sceneRole"] === role) found = object as Group | Mesh;
      });
      return found;
    };

    const pitcher = roleObject("stand-pitcher");
    const basket = roleObject("stand-basket");
    expect(pitcher).toBeDefined();
    expect(basket).toBeDefined();
    expect((pitcher?.position.x ?? 0) + 0.19)
      .toBeLessThan(STAND_LAYOUT.sellerSightline.minX);
    expect((basket?.position.x ?? 0) + 0.27)
      .toBeLessThan(STAND_LAYOUT.sellerSightline.minX);
    expect(STAND_LAYOUT.cupFootprint.minX)
      .toBeGreaterThan(STAND_LAYOUT.sellerSightline.maxX);
  });

  it("reduces visible juice and lemons with completed sales", () => {
    const root = new Group();
    const shutter = new Group();
    root.add(shutter);
    const detail = populateStand(root, shutter);

    let juice: Mesh | undefined;
    const lemons: Group[] = [];
    root.traverse((object) => {
      if (object.userData["sceneRole"] === "stand-juice") juice = object as Mesh;
      if (object.userData["sceneRole"] === "stand-stock-lemon") {
        lemons.push(object as Group);
      }
    });

    detail.setStock(100, 100);
    expect(juice?.scale.y).toBeCloseTo(1);
    expect(lemons.filter((lemon) => lemon.visible)).toHaveLength(8);

    detail.setStock(50, 100);
    expect(juice?.scale.y).toBeCloseTo(0.5);
    expect(lemons.filter((lemon) => lemon.visible)).toHaveLength(4);
    expect(visibleLemonCountForStock(25, 100)).toBe(2);

    detail.setStock(0, 100);
    expect(juice?.visible).toBe(false);
    expect(lemons.filter((lemon) => lemon.visible)).toHaveLength(0);
  });
});
