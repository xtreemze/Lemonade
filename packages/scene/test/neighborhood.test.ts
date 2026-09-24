import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";

import {
  FRONT_PROPERTY_LAYOUT,
  populateNeighborhood,
  updateNeighborhoodActivity,
  weatherWindGustAt,
  weatherWindStrength,
} from "../src/neighborhood.js";
import {
  DEFAULT_RESIDENTIAL_SEED,
  generateResidentialLayout,
  residentialFootprintIntersectsHardscape,
  residentialPointIsBlocked,
} from "../src/residential-layout.js";
import { STAND_WORLD_Z } from "../src/stand-anchors.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";
import { gardenSignPosition, STREET_LAYOUT } from "../src/street-layout.js";
import { WORLD_SCALE } from "../src/world-scale.js";

// Three.js's `Object3D.userData` is typed as `Record<string, any>`; these
// helpers isolate that boundary so callers deal in validated, narrow types
// instead of propagating `any` through map/filter callbacks.
const proceduralSeedOf = (object: Object3D): number => {
  const seed: unknown = object.userData["proceduralSeed"];
  return typeof seed === "number" ? seed : Number.NaN;
};

const meshGeometryUuid = (object: Object3D): string | null => {
  if (!(object instanceof Mesh)) {
    return null;
  }
  const geometry: unknown = object.geometry;
  if (geometry === null || typeof geometry !== "object") {
    return null;
  }
  const uuid: unknown = (geometry as Record<string, unknown>).uuid;
  return typeof uuid === "string" ? uuid : null;
};

describe("neighborhood world scale", () => {
  it("extends the world with LOD scenery beyond the cinematic camera envelope", () => {
    const scene = new Scene();
    const stats = populateNeighborhood(scene);

    expect(stats.worldSpan).toBeGreaterThanOrEqual(220);
    expect(stats.houseLods).toBeGreaterThanOrEqual(48);
    expect(stats.featuredHomes).toBe(1);
    expect(stats.frontProperties).toBeGreaterThanOrEqual(7);
    expect(stats.driveways).toBe(stats.houseLods);
    expect(stats.treeLods).toBeGreaterThanOrEqual(64);
    expect(stats.yardDetails).toBeGreaterThanOrEqual(12);
    expect(stats.flowers).toBeGreaterThanOrEqual(8);
    expect(stats.pavedRoads).toBeGreaterThanOrEqual(60);
    expect(stats.windResponsive).toBeGreaterThanOrEqual(stats.treeLods + stats.shrubs);
    expect(stats.roadSegments).toBeGreaterThanOrEqual(150);

    let lodCount = 0;
    let standHomeCount = 0;
    let standNeighborCount = 0;
    let pavedRoadCount = 0;
    let flowerCount = 0;
    const treeVariants = new Set<number>();
    const shrubVariants = new Set<number>();
    scene.traverse((object) => {
      if (object.userData["lodMode"] === "distance-two-level") {
        lodCount += 1;
      }
      if (object.userData["sceneRole"] === "stand-home") {
        standHomeCount += 1;
      }
      if (object.userData["sceneRole"] === "stand-neighbor") {
        standNeighborCount += 1;
      }
      if (object.userData["sceneRole"] === "paved-road") {
        pavedRoadCount += 1;
      }
      if (object.userData["sceneRole"] === "garden-flower") {
        flowerCount += 1;
      }
      const variant: unknown = object.userData["plantVariant"];
      if (object.userData["sceneRole"] === "procedural-tree" && typeof variant === "number") {
        treeVariants.add(variant);
      }
      if (object.userData["sceneRole"] === "procedural-shrub" && typeof variant === "number") {
        shrubVariants.add(variant);
      }
    });
    expect(lodCount).toBe(stats.houseLods + stats.treeLods + stats.shrubs);
    expect(standHomeCount).toBe(1);
    expect(standNeighborCount).toBe(1);
    expect(pavedRoadCount).toBe(stats.pavedRoads);
    expect(flowerCount).toBe(stats.flowers);
    const flowerBeds = scene.children.filter(
      (object) => object.userData["sceneRole"] === "garden-flower",
    );
    expect(
      flowerBeds.every((bed) => bed.userData["flowerCount"] === 5 && bed.children.length === 5),
    ).toBe(true);
    const fences = scene.children.filter((object) => object.userData["sceneRole"] === "fence");
    expect(fences.length).toBeGreaterThanOrEqual(8);
    expect(fences.every((fence) => typeof fence.userData["propertyRole"] === "string")).toBe(true);
    expect(treeVariants.size).toBeGreaterThan(8);
    expect(shrubVariants.size).toBeGreaterThan(4);

    const proceduralPlants = scene.children.filter(
      (object) =>
        object.userData["sceneRole"] === "procedural-tree" ||
        object.userData["sceneRole"] === "procedural-shrub",
    );
    expect(
      proceduralPlants.every(
        (plant) =>
          plant.userData["proceduralTechnique"] === "seeded-distance-lod" &&
          typeof plant.userData["proceduralSeed"] === "number",
      ),
    ).toBe(true);
    expect(new Set(proceduralPlants.map((plant) => proceduralSeedOf(plant))).size).toBeGreaterThan(
      16,
    );

    const reusesGeometryWithinPlant = proceduralPlants.some((plant) => {
      const geometryIds: string[] = [];
      plant.traverse((object) => {
        const uuid = meshGeometryUuid(object);
        if (uuid !== null) {
          geometryIds.push(uuid);
        }
      });
      return geometryIds.length > 3 && new Set(geometryIds).size < geometryIds.length;
    });
    expect(reusesGeometryWithinPlant).toBe(true);

    expect(flowerBeds.every((bed) => typeof bed.userData["proceduralSeed"] === "number")).toBe(true);
    const firstFlowerBed = flowerBeds[0];
    expect(firstFlowerBed).toBeDefined();
    if (firstFlowerBed !== undefined) {
      const geometryIds: string[] = [];
      firstFlowerBed.traverse((object) => {
        const uuid = meshGeometryUuid(object);
        if (uuid !== null) {
          geometryIds.push(uuid);
        }
      });
      expect(new Set(geometryIds).size).toBeLessThan(geometryIds.length);
    }

    const residentialHomes = scene.children.filter((object) => {
      const role: unknown = object.userData["sceneRole"];
      return typeof role === "string" && role.startsWith("residential-");
    });
    expect(residentialHomes.some((home) => home.position.z > 12)).toBe(true);
    expect(residentialHomes.some((home) => home.position.z < -58)).toBe(true);
    expect(residentialHomes.some((home) => Math.abs(home.position.x) > 65)).toBe(true);
  });

  it("renders residential driveways at the authoritative driveway width", () => {
    const scene = new Scene();
    const stats = populateNeighborhood(scene, DEFAULT_RESIDENTIAL_SEED);
    const drivewayBatch = scene.getObjectByName("DrivewaySurfaces");

    expect(drivewayBatch).toBeInstanceOf(InstancedMesh);
    if (!(drivewayBatch instanceof InstancedMesh)) {
      return;
    }
    expect(drivewayBatch.count).toBe(stats.driveways);

    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    for (let index = 0; index < drivewayBatch.count; index += 1) {
      drivewayBatch.getMatrixAt(index, matrix);
      matrix.decompose(position, rotation, scale);
      expect(scale.z).toBeCloseTo(WORLD_SCALE.street.drivewayWidth);
    }
  });

  it("keeps rendered static scenery and signs off roads, sidewalks, and driveways", () => {
    const layout = generateResidentialLayout(DEFAULT_RESIDENTIAL_SEED);
    const scene = new Scene();
    populateNeighborhood(scene, DEFAULT_RESIDENTIAL_SEED);

    const checkedRoles = new Set([
      "procedural-tree",
      "procedural-shrub",
      "garden-flower",
      "mailbox",
      "fence",
    ]);
    let checkedScenery = 0;

    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      const role: unknown = object.userData["sceneRole"];
      if (typeof role !== "string" || !checkedRoles.has(role)) {
        return;
      }

      const bounds = new Box3().setFromObject(object);
      const centerX = (bounds.min.x + bounds.max.x) / 2;
      const centerZ = (bounds.min.z + bounds.max.z) / 2;
      const halfWidth = (bounds.max.x - bounds.min.x) / 2;
      const halfDepth = (bounds.max.z - bounds.min.z) / 2;

      expect(
        residentialFootprintIntersectsHardscape(
          { x: centerX, z: centerZ },
          layout,
          halfWidth,
          halfDepth,
        ),
      ).toBe(false);

      if (role === "procedural-tree") {
        expect(
          residentialPointIsBlocked(
            { x: object.position.x, z: object.position.z },
            layout,
            Math.max(halfWidth, halfDepth),
          ),
        ).toBe(false);
      }
      checkedScenery += 1;
    });

    expect(checkedScenery).toBeGreaterThanOrEqual(80);

    for (let index = 0; index < 40; index += 1) {
      const sign = gardenSignPosition(index);
      expect(sign.z).toBeLessThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(
        residentialFootprintIntersectsHardscape({ x: sign.x, z: sign.z }, layout, 0.48, 0.12),
      ).toBe(false);
    }
  });

  it("animates residence doors, windows, and sunny-yard sprinklers from shared activity state", () => {
    const scene = new Scene();
    populateNeighborhood(scene, DEFAULT_RESIDENTIAL_SEED);

    const home = scene.children.find((object) => object.userData["sceneRole"] === "stand-home");
    expect(home).toBeDefined();
    if (home === undefined) {
      return;
    }

    let door: Object3D | undefined;
    let window: Mesh | undefined;
    home.traverse((object) => {
      if (object.userData["sceneRole"] === "house-door") {
        door = object;
      }
      if (
        object.userData["sceneRole"] === "house-window" &&
        object instanceof Mesh &&
        window === undefined
      ) {
        window = object;
      }
    });
    expect(door).toBeDefined();
    expect(window).toBeDefined();

    const sprinkler = scene.children.find(
      (object) => object.userData["sceneRole"] === "yard-sprinkler",
    );
    expect(sprinkler).toBeDefined();
    const sprinklerRole =
      typeof sprinkler?.userData["propertyRole"] === "string"
        ? sprinkler.userData["propertyRole"]
        : "stand-home";

    const roles = new Set(["stand-home", sprinklerRole]);
    updateNeighborhoodActivity(
      scene,
      [...roles].map((propertyRole) =>
        Object.freeze({
          propertyRole,
          doorOpen: propertyRole === "stand-home",
          windowActivity: propertyRole === "stand-home",
          sprinklerOn: propertyRole === sprinklerRole,
          vehicleParked: false,
          mailServiced: false,
          gardenerPresent: false,
        }),
      ),
      1500,
    );

    expect(door?.rotation.y).toBeLessThan(-0.9);
    const windowMaterial =
      window?.material instanceof MeshStandardMaterial ? window.material : null;
    expect(windowMaterial?.emissiveIntensity).toBeGreaterThan(0);
    expect(sprinkler?.visible).toBe(true);

    updateNeighborhoodActivity(
      scene,
      [...roles].map((propertyRole) =>
        Object.freeze({
          propertyRole,
          doorOpen: false,
          windowActivity: false,
          sprinklerOn: false,
          vehicleParked: false,
          mailServiced: false,
          gardenerPresent: false,
        }),
      ),
      2000,
    );
    expect(door?.rotation.y).toBeCloseTo(0);
    expect(windowMaterial?.emissiveIntensity).toBe(0);
    expect(sprinkler?.visible).toBe(false);
  });

  it("makes storm wind materially stronger and gustier than ordinary weather", () => {
    expect(weatherWindStrength("sunny")).toBeGreaterThan(0);
    expect(weatherWindStrength("thunderstorm")).toBeGreaterThan(weatherWindStrength("cloudy") * 4);

    const ordinary = weatherWindGustAt("cloudy", 2.4, 0.7);
    const storm = weatherWindGustAt("thunderstorm", 2.4, 0.7);
    expect(Math.abs(storm)).toBeGreaterThanOrEqual(Math.abs(ordinary));
    expect(weatherWindGustAt("thunderstorm", 2.4, 0.7)).toBe(storm);
  });

  it("puts the stand in the featured garden beside its driveway and near the next property", () => {
    const standHome = FRONT_PROPERTY_LAYOUT.find((property) => property.role === "stand-home");
    const neighbor = FRONT_PROPERTY_LAYOUT.find((property) => property.role === "stand-neighbor");
    expect(standHome).toBeDefined();
    expect(neighbor).toBeDefined();
    if (standHome === undefined || neighbor === undefined) {
      return;
    }

    const sharedBoundaryX = (standHome.houseX + neighbor.houseX) / 2;
    const standRightEdge = STAND_LAYOUT.body.size[0] / 2;

    expect(standHome.houseX).toBeLessThan(-3);
    expect(standHome.drivewayX).toBeLessThan(standHome.houseX);
    expect(sharedBoundaryX).toBeGreaterThan(standRightEdge);
    expect(sharedBoundaryX - standRightEdge).toBeLessThan(0.75);

    const standBoxes = [
      STAND_LAYOUT.body,
      STAND_LAYOUT.counter,
      STAND_LAYOUT.frontPanel,
      STAND_LAYOUT.canopy,
      ...STAND_LAYOUT.posts,
    ];
    const standFrontEdge = Math.max(
      ...standBoxes.map((part) => STAND_WORLD_Z + part.position[2] + part.size[2] / 2),
    );
    expect(standFrontEdge).toBeLessThan(STREET_LAYOUT.nearSidewalk.minZ);
    expect(STAND_WORLD_Z).toBeLessThan(STREET_LAYOUT.nearSidewalk.minZ);
  });

  it("faces every mailbox toward the street independent of house orientation", () => {
    const scene = new Scene();
    populateNeighborhood(scene, 0x5e_ed);
    const mailboxes = scene.children.filter((object) => object.userData["sceneRole"] === "mailbox");
    const expectedCount = FRONT_PROPERTY_LAYOUT.filter(
      (property) => property.mailboxX !== null,
    ).length;

    expect(mailboxes).toHaveLength(expectedCount);
    expect(FRONT_PROPERTY_LAYOUT.some((property) => Math.abs(property.rotationY) > 0.02)).toBe(
      true,
    );
    for (const mailbox of mailboxes) {
      expect(mailbox.rotation.y).toBeCloseTo(-Math.PI / 2);
      const streetFacingYaw: unknown = mailbox.userData["streetFacingYaw"];
      expect(streetFacingYaw).toBe(-Math.PI / 2);
    }
  });

  it("avoids mirrored front-property repetition", () => {
    const xs = FRONT_PROPERTY_LAYOUT.map((property) => property.houseX);
    const mirrored = xs.filter((x) => xs.some((candidate) => Math.abs(candidate + x) < 0.25));

    expect(mirrored).toHaveLength(0);
    expect(
      new Set(FRONT_PROPERTY_LAYOUT.map((property) => property.houseZ)).size,
    ).toBeGreaterThanOrEqual(5);
  });
});
