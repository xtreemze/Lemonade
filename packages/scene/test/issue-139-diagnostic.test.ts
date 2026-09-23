import { describe, it } from "vitest";

import {
  HOUSE_FOOTPRINT_DEPTH,
  HOUSE_FOOTPRINT_WIDTH,
  generateResidentialLayout,
  residentialAccessLayout,
  residentialFootprintIntersectsHardscape,
} from "../src/residential-layout.js";

describe("issue 139 diagnostics", () => {
  it("prints remaining geometry offenders", () => {
    const layout = generateResidentialLayout(0xdecafbad);
    const properties = [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ];
    for (const property of properties) {
      const localHalfWidth = (HOUSE_FOOTPRINT_WIDTH * property.scale) / 2;
      const localHalfDepth = (HOUSE_FOOTPRINT_DEPTH * property.scale) / 2;
      const cosine = Math.abs(Math.cos(property.rotationY));
      const sine = Math.abs(Math.sin(property.rotationY));
      const halfWidth = localHalfWidth * cosine + localHalfDepth * sine;
      const halfDepth = localHalfWidth * sine + localHalfDepth * cosine;
      const collisions = layout.exclusions.filter((rect) =>
        rect.role !== "path" &&
        residentialFootprintIntersectsHardscape(
          { x: property.houseX, z: property.houseZ },
          { exclusions: [rect] },
          halfWidth,
          halfDepth,
        ),
      );
      if (collisions.length > 0) {
        console.log("ISSUE139_HOUSE_COLLISION", JSON.stringify({
          property,
          collisions: collisions.map((rect) => ({
            role: rect.role,
            x: rect.x,
            z: rect.z,
            minX: rect.minX,
            maxX: rect.maxX,
            minZ: rect.minZ,
            maxZ: rect.maxZ,
          })),
        }));
      }
    }

    const accessLayout = generateResidentialLayout(0x51de);
    const westMid = [
      ...accessLayout.frontProperties,
      ...accessLayout.middleProperties,
      ...accessLayout.backProperties,
      ...accessLayout.outerProperties,
    ].find((property) => property.role === "west-mid");
    if (westMid !== undefined) {
      const access = residentialAccessLayout(westMid, accessLayout.seed);
      const driveway = accessLayout.exclusions.find(
        (rect) =>
          rect.role === "driveway" &&
          Math.abs((rect.minX + rect.maxX) / 2 - access.drivewayCenterX) < 0.02 &&
          Math.abs((rect.minZ + rect.maxZ) / 2 - access.drivewayCenterZ) < 0.02,
      );
      console.log("ISSUE139_WEST_MID_ACCESS", JSON.stringify({
        property: westMid,
        access,
        driveway,
        sidewalks: accessLayout.exclusions.filter((rect) => rect.role === "sidewalk"),
        roads: accessLayout.exclusions.filter((rect) => rect.role === "road"),
      }));
    }

    const yardLayout = generateResidentialLayout(0x7a11);
    console.log("ISSUE139_BACKYARD_COUNT", JSON.stringify({
      total: yardLayout.trees.length,
      backyard: yardLayout.trees.filter((tree) => tree.propertyRole !== null && tree.yardZone === "back").length,
    }));
  });
});
