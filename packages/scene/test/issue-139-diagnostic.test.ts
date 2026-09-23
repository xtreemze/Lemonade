import { describe, it } from "vitest";

import {
  HOUSE_FOOTPRINT_DEPTH,
  HOUSE_FOOTPRINT_WIDTH,
  generateResidentialLayout,
  residentialAccessLayout,
  residentialFootprintIntersectsHardscape,
  residentialPointIsBlocked,
} from "../src/residential-layout.js";

describe("issue 139 diagnostics", () => {
  it("prints exact residential invariant offenders", () => {
    const plantingLayout = generateResidentialLayout(0xdecafbad);
    const allPlantingProperties = [
      ...plantingLayout.frontProperties,
      ...plantingLayout.middleProperties,
      ...plantingLayout.backProperties,
      ...plantingLayout.outerProperties,
    ];

    const blockedTrees = plantingLayout.trees.flatMap((tree, index) => {
      const clearance = 3.5 * tree.scale;
      if (!residentialPointIsBlocked(tree, plantingLayout, clearance)) return [];
      const hardscape = plantingLayout.exclusions
        .filter((rect) =>
          residentialFootprintIntersectsHardscape(
            tree,
            { exclusions: [rect] },
            clearance,
            clearance,
          ),
        )
        .map((rect) => ({ role: rect.role, x: rect.x, z: rect.z, minX: rect.minX, maxX: rect.maxX, minZ: rect.minZ, maxZ: rect.maxZ }));
      const houses = allPlantingProperties.flatMap((property) => {
        const localHalfWidth = (HOUSE_FOOTPRINT_WIDTH * property.scale) / 2;
        const localHalfDepth = (HOUSE_FOOTPRINT_DEPTH * property.scale) / 2;
        const cosine = Math.abs(Math.cos(property.rotationY));
        const sine = Math.abs(Math.sin(property.rotationY));
        const halfWidth = localHalfWidth * cosine + localHalfDepth * sine;
        const halfDepth = localHalfWidth * sine + localHalfDepth * cosine;
        const footprint =
          Math.abs(tree.x - property.houseX) <= halfWidth + clearance &&
          Math.abs(tree.z - property.houseZ) <= halfDepth + clearance;
        const forwardDistance =
          (tree.z - property.houseZ) * Math.cos(property.rotationY);
        const front =
          Math.abs(tree.x - property.houseX) < 3.45 + clearance &&
          forwardDistance > -0.4 - clearance &&
          forwardDistance < 6.5 + clearance;
        return footprint || front
          ? [{ role: property.role, footprint, front, forwardDistance, houseX: property.houseX, houseZ: property.houseZ }]
          : [];
      });
      return [{ index, tree, clearance, hardscape, houses }];
    });
    console.log("ISSUE139_BLOCKED_TREES", JSON.stringify(blockedTrees));

    const accessLayout = generateResidentialLayout(0x51de);
    const allAccessProperties = [
      ...accessLayout.frontProperties,
      ...accessLayout.middleProperties,
      ...accessLayout.backProperties,
      ...accessLayout.outerProperties,
    ];
    const missingDriveways = allAccessProperties.flatMap((property) => {
      if (property.drivewayX === null) return [];
      const access = residentialAccessLayout(property, accessLayout.seed);
      const exact = accessLayout.exclusions.find(
        (rect) =>
          rect.role === "driveway" &&
          Math.abs((rect.minX + rect.maxX) / 2 - access.drivewayCenterX) < 0.02 &&
          Math.abs((rect.minZ + rect.maxZ) / 2 - access.drivewayCenterZ) < 0.02,
      );
      if (exact !== undefined) return [];
      const drivewayRects = accessLayout.exclusions
        .filter((rect) => rect.role === "driveway")
        .map((rect) => ({
          x: (rect.minX + rect.maxX) / 2,
          z: (rect.minZ + rect.maxZ) / 2,
          dx: Math.abs((rect.minX + rect.maxX) / 2 - access.drivewayCenterX),
          dz: Math.abs((rect.minZ + rect.maxZ) / 2 - access.drivewayCenterZ),
        }))
        .sort((a, b) => a.dx + a.dz - (b.dx + b.dz))
        .slice(0, 3);
      return [{ role: property.role, drivewayX: property.drivewayX, access, nearest: drivewayRects }];
    });
    console.log("ISSUE139_MISSING_DRIVEWAYS", JSON.stringify(missingDriveways));

    const yardLayout = generateResidentialLayout(0x7a11);
    const backyardTrees = yardLayout.trees.filter(
      (tree) => tree.propertyRole !== null && tree.yardZone === "back",
    );
    const allYardProperties = [
      ...yardLayout.frontProperties,
      ...yardLayout.middleProperties,
      ...yardLayout.backProperties,
      ...yardLayout.outerProperties,
    ];
    const assigned = new Set(backyardTrees.map((tree) => tree.propertyRole));
    console.log(
      "ISSUE139_BACKYARD_COUNT",
      JSON.stringify({
        totalTrees: yardLayout.trees.length,
        backyardTrees: backyardTrees.length,
        requiredGreaterThan: yardLayout.trees.length / 3,
        missingRoles: allYardProperties.filter((property) => !assigned.has(property.role)).map((property) => property.role),
      }),
    );
  });
});
