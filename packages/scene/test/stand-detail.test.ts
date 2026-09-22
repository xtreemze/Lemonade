import { Group, Mesh } from "three";
import { describe, expect, it } from "vitest";

import {
  populateStand,
  STAND_SIGN_CENTER_Y,
  visibleLemonCountForStock,
} from "../src/stand-detail.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";

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
    expect(detail?.children.length).toBeGreaterThanOrEqual(18);
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
    expect(STAND_SIGN_CENTER_Y - 0.28).toBeGreaterThan(canopyTop + 0.15);
  });

  it("keeps pitcher, basket, and lemons on the opposite side from the cup stack", () => {
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
    expect((pitcher?.position.x ?? 0) + 0.25)
      .toBeLessThan(STAND_LAYOUT.sellerSightline.minX);
    expect(basket?.position.x).toBeLessThan(STAND_LAYOUT.sellerSightline.minX);

    let lemonCount = 0;
    root.traverse((object) => {
      if (object.userData["sceneRole"] !== "stand-stock-lemon") return;
      lemonCount += 1;
      expect(object.position.x).toBeLessThan(STAND_LAYOUT.sellerSightline.minX);
    });
    expect(lemonCount).toBe(8);
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
