import { Group } from "three";
import { describe, expect, it } from "vitest";

import {
  populateStand,
  STAND_SIGN_CENTER_Y,
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
    expect(STAND_SIGN_CENTER_Y - 0.28).toBeGreaterThan(canopyTop + 0.15);
  });
});
