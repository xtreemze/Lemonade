import { describe, it } from "vitest";

import {
  generateResidentialLayout,
  residentialAccessLayout,
  residentialFootprintIntersectsHardscape,
  residentialPointIsBlocked,
} from "../src/residential-layout.js";

describe("issue 139 diagnostics", () => {
  it("prints remaining tree and driveway offenders", () => {
    const layout = generateResidentialLayout(0xdecafbad);
    for (const [index, tree] of layout.trees.entries()) {
      const clearance = 3.5 * tree.scale;
      if (!residentialPointIsBlocked(tree, layout, clearance)) continue;
      const hardscape = layout.exclusions.filter((rect) =>
        residentialFootprintIntersectsHardscape(
          tree,
          { exclusions: [rect] },
          clearance,
          clearance,
        ),
      );
      console.log("ISSUE139_TREE", JSON.stringify({
        index,
        tree,
        clearance,
        hardscape: hardscape.map((rect) => ({
          role: rect.role,
          x: rect.x,
          z: rect.z,
          minX: rect.minX,
          maxX: rect.maxX,
          minZ: rect.minZ,
          maxZ: rect.maxZ,
          length: rect.length,
          width: rect.width,
          rotationY: rect.rotationY,
        })),
      }));
    }

    const accessLayout = generateResidentialLayout(0x51de);
    const property = [
      ...accessLayout.frontProperties,
      ...accessLayout.middleProperties,
      ...accessLayout.backProperties,
      ...accessLayout.outerProperties,
    ].find((candidate) => candidate.role === "west-mid");
    if (property === undefined) return;
    const access = residentialAccessLayout(property, accessLayout.seed);
    const driveway = accessLayout.exclusions.find(
      (rect) =>
        rect.role === "driveway" &&
        Math.abs((rect.minX + rect.maxX) / 2 - access.drivewayCenterX) < 0.02 &&
        Math.abs((rect.minZ + rect.maxZ) / 2 - access.drivewayCenterZ) < 0.02,
    );
    if (driveway === undefined) return;
    const aabbOverlaps = (left: typeof driveway, right: typeof driveway) =>
      left.maxX >= right.minX &&
      left.minX <= right.maxX &&
      left.maxZ >= right.minZ &&
      left.minZ <= right.maxZ;
    console.log("ISSUE139_DRIVEWAY", JSON.stringify({
      property,
      access,
      driveway,
      aabbRoads: accessLayout.exclusions.filter(
        (rect) => rect.role === "road" && aabbOverlaps(driveway, rect),
      ),
      nearbySidewalks: accessLayout.exclusions.filter(
        (rect) => rect.role === "sidewalk" && aabbOverlaps(driveway, rect),
      ),
    }));
  });
});
