import { Group } from "three";
import { describe, expect, it } from "vitest";

import { decorateStand } from "../src/stand-detail.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";

describe("stand detail", () => {
  it("adds a handmade sign and counter dressing as one lazy detail group", () => {
    const root = new Group();

    decorateStand(root, STAND_LAYOUT.counterTopY);

    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.userData["sceneRole"]).toBe("stand-detail");
    expect(root.children[0]?.children.length).toBeGreaterThanOrEqual(8);
  });
});
