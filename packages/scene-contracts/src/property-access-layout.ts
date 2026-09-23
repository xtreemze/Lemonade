import {
  generateResidentialLayout,
  residentialAccessLayout,
} from "./residential-layout.js";
import { WORLD_SCALE } from "./world-scale.js";

export type PropertyAccessRole = "driveway" | "front-path";

export type PropertyAccessSurfaceSpec = Readonly<{
  role: PropertyAccessRole;
  length: number;
  width: number;
  x: number;
  z: number;
  rotationY: number;
}>;

export const propertyAccessSurfaceSpecs = (
  seed: number,
): readonly PropertyAccessSurfaceSpec[] => {
  const layout = generateResidentialLayout(seed);
  const properties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ];
  const specs: PropertyAccessSurfaceSpec[] = [];

  for (const property of properties) {
    if (property.drivewayX === null) continue;
    const access = residentialAccessLayout(property, seed);
    specs.push(
      Object.freeze({
        role: "driveway",
        length: access.drivewayLength,
        width: WORLD_SCALE.vehicle.width,
        x: access.drivewayCenterX,
        z: access.drivewayCenterZ,
        rotationY: access.drivewayRotationY,
      }),
      Object.freeze({
        role: "front-path",
        length: access.pathLength,
        width: access.pathWidth,
        x: access.pathCenterX,
        z: access.pathCenterZ,
        rotationY: access.pathRotationY,
      }),
    );
  }

  return Object.freeze(specs);
};
