import { Group } from "three";
import { describe, expect, it } from "vitest";

import { populateStand } from "../src/stand-detail.js";

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
    expect(detail?.children.length).toBeGreaterThanOrEqual(8);
  });
});
