import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { characterProfileFor } from "../src/characters.js";
import { SELLER_Z } from "../src/stand-anchors.js";
import { STREET_LAYOUT } from "../src/street-layout.js";
import {
  createStreetStoryboard,
  formatPriceLabel,
} from "../src/storyboard-create.js";
import {
  buyerPhaseAt,
  buyerSlotForSale,
  completedSalesAt,
  endingCloseupProgressAt,
  endingConfidenceAt,
  remainingCameraProgressAt,
  remainingCupsAt,
  sceneCameraComposition,
  sceneShotAt,
  sceneViewportClass,
} from "../src/storyboard.js";

const projectedScreenY = (
  width: number,
  height: number,
  shot: "forecast" | "stand" | "remaining",
  point: readonly [number, number, number],
): number => {
  const composition = sceneCameraComposition(width, height, shot);
  const camera = new PerspectiveCamera(
    composition.fov,
    width / height,
    0.1,
    180,
  );
  camera.position.set(...composition.position);
  camera.lookAt(...composition.lookAt);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const projected = new Vector3(...point).project(camera);
  return (1 - projected.y) / 2;
};

const visibleWorldSpan = (
  width: number,
  height: number,
  shot: "forecast" | "stand",
  point: readonly [number, number, number],
): Readonly<{ horizontal: number; vertical: number }> => {
  const composition = sceneCameraComposition(width, height, shot);
  const cameraPosition = new Vector3(...composition.position);
  const target = new Vector3(...composition.lookAt);
  const forward = target.sub(cameraPosition).normalize();
  const depth = new Vector3(...point).sub(cameraPosition).dot(forward);
  const vertical =
    2 * depth * Math.tan((composition.fov * Math.PI) / 360);
  return Object.freeze({
    horizontal: vertical * (width / height),
    vertical,
  });
};

describe("street simulation storyboard", () => {
  it("maps every sale to a buyer lifecycle and decrements inventory on purchase completion", () => {
    const storyboard = createStreetStoryboard({
      durationMs: 6_000,
      prepared: 20,
      sold: 7,
      visibleSigns: 3,
      priceCents: 150,
      ambientPedestrianCount: 10,
    });

    expect(storyboard.durationMs).toBe(6_000);
    expect(storyboard.sales).toHaveLength(7);
    expect(storyboard.sales.map((sale) => sale.saleNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(storyboard.sales.map((sale) => sale.remainingCups)).toEqual([
      19, 18, 17, 16, 15, 14, 13,
    ]);

    const firstSale = storyboard.sales[0];
    const lastSale = storyboard.sales.at(-1);
    if (firstSale === undefined || lastSale === undefined) {
      throw new Error("expected sale beats");
    }

    expect(buyerPhaseAt(firstSale, firstSale.approachAtMs)).toBe("approaching");
    expect(buyerPhaseAt(firstSale, firstSale.purchaseAtMs)).toBe("purchasing");
    expect(buyerPhaseAt(firstSale, firstSale.purchaseEndAtMs)).toBe("drinking");
    expect(buyerPhaseAt(firstSale, firstSale.drinkEndAtMs)).toBe("departing");
    expect(buyerPhaseAt(firstSale, firstSale.departAtMs + 1)).toBe("inactive");

    expect(completedSalesAt(storyboard, firstSale.purchaseAtMs)).toBe(0);
    expect(remainingCupsAt(storyboard, firstSale.purchaseAtMs)).toBe(20);
    expect(completedSalesAt(storyboard, firstSale.purchaseEndAtMs)).toBe(1);
    expect(remainingCupsAt(storyboard, firstSale.purchaseEndAtMs)).toBe(19);
    expect(completedSalesAt(storyboard, lastSale.purchaseEndAtMs)).toBe(7);
    expect(remainingCupsAt(storyboard, lastSale.purchaseEndAtMs)).toBe(13);
  });

  it("covers the complete restored level-four envelope without truncating sales or signs", () => {
    const storyboard = createStreetStoryboard({
      durationMs: 6_000,
      prepared: 400,
      sold: 400,
      visibleSigns: 40,
      priceCents: 999,
      ambientPedestrianCount: 18,
    });

    expect(storyboard.prepared).toBe(400);
    expect(storyboard.sold).toBe(400);
    expect(storyboard.sales).toHaveLength(400);
    expect(storyboard.visibleSigns).toBe(40);
    expect(storyboard.sales.at(-1)?.remainingCups).toBe(0);
    expect(completedSalesAt(storyboard, 6_000)).toBe(400);
    expect(remainingCupsAt(storyboard, 6_000)).toBe(0);
  });

  it("keeps buyer rig slots stable and collision-free during the maximum-volume lifecycle", () => {
    const storyboard = createStreetStoryboard({
      durationMs: 6_000,
      prepared: 400,
      sold: 400,
      visibleSigns: 40,
      priceCents: 999,
      ambientPedestrianCount: 18,
    });
    const poolSize = 192;

    for (let index = 0; index < storyboard.sales.length; index += 1) {
      const sale = storyboard.sales[index];
      if (sale === undefined) continue;
      const next = storyboard.sales[index + poolSize];
      if (next === undefined) continue;
      expect(buyerSlotForSale(sale, poolSize)).toBe(buyerSlotForSale(next, poolSize));
      expect(sale.departAtMs).toBeLessThanOrEqual(next.approachAtMs);
    }
  });

  it("keeps non-buyers more numerous and assigns ad viewers only when signs exist", () => {
    const advertised = createStreetStoryboard({
      durationMs: 6_000,
      prepared: 60,
      sold: 18,
      visibleSigns: 5,
      priceCents: 175,
      ambientPedestrianCount: 12,
    });

    expect(advertised.passersBy.length).toBeGreaterThan(advertised.sales.length);
    expect(advertised.adViewerCount).toBeGreaterThan(0);
    expect(
      advertised.passersBy.filter((pedestrian) => pedestrian.seesAdvertisement),
    ).toHaveLength(advertised.adViewerCount);
    expect(
      advertised.passersBy
        .filter((pedestrian) => pedestrian.seesAdvertisement)
        .every((pedestrian) => pedestrian.signIndex >= 0),
    ).toBe(true);

    const unadvertised = createStreetStoryboard({
      durationMs: 6_000,
      prepared: 60,
      sold: 18,
      visibleSigns: 0,
      priceCents: 175,
      ambientPedestrianCount: 12,
    });

    expect(unadvertised.passersBy.length).toBeGreaterThan(unadvertised.sales.length);
    expect(unadvertised.adViewerCount).toBe(0);
    expect(unadvertised.passersBy.some((pedestrian) => pedestrian.seesAdvertisement)).toBe(false);
  });

  it("formats the actual selected price for every advertising sign", () => {
    expect(formatPriceLabel(0)).toBe("FREE");
    expect(formatPriceLabel(10)).toBe("10¢");
    expect(formatPriceLabel(99)).toBe("99¢");
    expect(formatPriceLabel(150)).toBe("$1.50");
    expect(formatPriceLabel(999)).toBe("$9.99");

    const storyboard = createStreetStoryboard({
      durationMs: 6_000,
      prepared: 10,
      sold: 4,
      visibleSigns: 2,
      priceCents: 175,
      ambientPedestrianCount: 8,
    });
    expect(storyboard.priceLabel).toBe("$1.75");
    expect(storyboard.priceCents).toBe(175);
  });

  it("holds six seconds of street activity then a four-second ending closeup", () => {
    const storyboard = createStreetStoryboard({
      durationMs: 10_000,
      prepared: 10,
      sold: 4,
      visibleSigns: 2,
      priceCents: 150,
      ambientPedestrianCount: 8,
    });

    expect(storyboard.shots.map((shot) => shot.kind)).toEqual([
      "stand",
      "remaining",
    ]);
    expect(storyboard.activeDurationMs).toBe(6_000);
    expect(storyboard.shots[0]?.startAtMs).toBe(0);
    expect(storyboard.shots.at(-1)?.endAtMs).toBe(10_000);
    expect(sceneShotAt(storyboard, 0)).toBe("stand");
    expect(sceneShotAt(storyboard, 5_999)).toBe("stand");
    expect(sceneShotAt(storyboard, 6_000)).toBe("remaining");
    expect(sceneShotAt(storyboard, 9_999)).toBe("remaining");

    expect(endingCloseupProgressAt(storyboard, 6_000)).toBe(0);
    expect(endingCloseupProgressAt(storyboard, 8_000)).toBeCloseTo(0.5);
    expect(endingCloseupProgressAt(storyboard, 10_000)).toBe(1);

    expect(endingConfidenceAt(storyboard, 6_000, 1, 5)).toBe(1);
    expect(endingConfidenceAt(storyboard, 8_000, 1, 5)).toBeCloseTo(3);
    expect(endingConfidenceAt(storyboard, 10_000, 1, 5)).toBe(5);

    expect(remainingCameraProgressAt(storyboard, 6_000)).toBe(0);
    expect(remainingCameraProgressAt(storyboard, 7_000)).toBeGreaterThan(0);
    expect(remainingCameraProgressAt(storyboard, 8_500)).toBe(1);
    expect(remainingCameraProgressAt(storyboard, 10_000)).toBe(1);
  });

  it("uses viewport classes for mobile-first framing that progressively reveals the neighborhood", () => {
    expect(sceneViewportClass(360, 740)).toBe("mobile-portrait");
    expect(sceneViewportClass(844, 390)).toBe("mobile-landscape");
    expect(sceneViewportClass(1024, 768)).toBe("tablet");
    expect(sceneViewportClass(1440, 900)).toBe("desktop");

    expect(sceneCameraComposition(360, 740, "forecast").mode).toBe("portrait");
    expect(sceneCameraComposition(768, 740, "stand").mode).toBe("balanced");
    expect(sceneCameraComposition(844, 390, "remaining").mode).toBe("wide");

    const portraitForecast = sceneCameraComposition(360, 740, "forecast");
    const portraitStand = sceneCameraComposition(360, 740, "stand");
    const portraitRemaining = sceneCameraComposition(360, 740, "remaining");
    expect(portraitForecast.position[1]).toBeGreaterThan(portraitStand.position[1]);
    expect(portraitForecast.position[2]).toBeGreaterThan(portraitStand.position[2]);
    expect(portraitStand.position[2]).toBeGreaterThanOrEqual(34);
    expect(portraitStand.fov).toBeGreaterThanOrEqual(56);
    expect(portraitRemaining.position[2]).toBeGreaterThanOrEqual(15);
    expect(portraitStand.position[2]).toBeGreaterThan(portraitRemaining.position[2]);
    expect(portraitForecast.lookAt[2]).toBeLessThan(portraitStand.lookAt[2]);
    expect(portraitRemaining.lookAt[2]).toBeGreaterThanOrEqual(1);
    expect(portraitRemaining.lookAt[0]).toBeGreaterThanOrEqual(0.4);

    const landscapeStand = sceneCameraComposition(844, 390, "stand");
    expect(landscapeStand.position[2])
      .toBeGreaterThan(STREET_LAYOUT.farSidewalk.maxZ + 16);
    expect(landscapeStand.lookAt[2]).toBeGreaterThan(STREET_LAYOUT.road.minZ);
    expect(landscapeStand.lookAt[2]).toBeLessThan(STREET_LAYOUT.road.maxZ);
    expect(landscapeStand.fov).toBeGreaterThanOrEqual(40);

    const portraitForecastExtent = visibleWorldSpan(
      360,
      740,
      "forecast",
      [0, 1.5, SELLER_Z],
    );
    const landscapeForecastExtent = visibleWorldSpan(
      844,
      390,
      "forecast",
      [0, 1.5, SELLER_Z],
    );
    const tabletStandExtent = visibleWorldSpan(
      1024,
      768,
      "stand",
      [0, 1.5, SELLER_Z],
    );
    const desktopStandExtent = visibleWorldSpan(
      1440,
      900,
      "stand",
      [0, 1.5, SELLER_Z],
    );

    expect(portraitForecastExtent.vertical).toBeGreaterThanOrEqual(50);
    expect(landscapeForecastExtent.horizontal).toBeGreaterThanOrEqual(55);
    expect(desktopStandExtent.horizontal)
      .toBeGreaterThan(tabletStandExtent.horizontal * 1.15);
  });

  it("keeps the stand and vendor around the lower third in portrait and landscape mobile framing", () => {
    for (const [width, height] of [
      [360, 740],
      [844, 390],
      [1024, 768],
      [1440, 900],
    ] as const) {
      for (const shot of ["forecast", "stand"] as const) {
        const standY = projectedScreenY(width, height, shot, [0, 1.5, 0]);
        const vendorY = projectedScreenY(width, height, shot, [0, 1.2, SELLER_Z]);
        expect(standY).toBeGreaterThanOrEqual(0.6);
        expect(standY).toBeLessThanOrEqual(0.78);
        expect(vendorY).toBeGreaterThanOrEqual(0.6);
        expect(vendorY).toBeLessThanOrEqual(0.8);
      }
    }
  });

  it("derives stable, varied character appearance and gait from the run seed", () => {
    const seed = 0x1ead2026;
    const first = characterProfileFor(seed, 7);
    const repeated = characterProfileFor(seed, 7);
    const neighbor = characterProfileFor(seed, 8);
    const otherRun = characterProfileFor(seed ^ 0x55aa55aa, 7);

    expect(repeated).toEqual(first);
    expect(neighbor).not.toEqual(first);
    expect(otherRun).not.toEqual(first);
    expect(first.walkPace).toBeGreaterThanOrEqual(0.88);
    expect(first.walkPace).toBeLessThanOrEqual(1.14);
    expect(first.gaitAmplitude).toBeGreaterThanOrEqual(0.48);
    expect(first.gaitAmplitude).toBeLessThanOrEqual(0.68);
  });

  it("is deterministic and never schedules more sales than prepared cups", () => {
    const input = {
      durationMs: 6_000,
      prepared: 8,
      sold: 12,
      visibleSigns: 2,
      priceCents: 150,
      ambientPedestrianCount: 6,
    } as const;

    const first = createStreetStoryboard(input);
    const second = createStreetStoryboard(input);

    expect(second).toEqual(first);
    expect(first.sold).toBe(8);
    expect(first.sales).toHaveLength(8);
    expect(first.sales.at(-1)?.remainingCups).toBe(0);
  });
});
