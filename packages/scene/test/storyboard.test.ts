import { describe, expect, it } from "vitest";

import { characterProfileFor } from "../src/characters.js";
import {
  createStreetStoryboard,
  formatPriceLabel,
} from "../src/storyboard-create.js";
import {
  buyerPhaseAt,
  buyerSlotForSale,
  completedSalesAt,
  remainingCameraProgressAt,
  remainingCupsAt,
  sceneCameraComposition,
  sceneShotAt,
} from "../src/storyboard.js";

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

  it("holds one stand shot during sales and reserves only the ending for inventory", () => {
    const storyboard = createStreetStoryboard({
      durationMs: 6_000,
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
    expect(storyboard.shots[0]?.startAtMs).toBe(0);
    expect(storyboard.shots.at(-1)?.endAtMs).toBe(6_000);
    expect(sceneShotAt(storyboard, 0)).toBe("stand");
    expect(sceneShotAt(storyboard, 3_200)).toBe("stand");
    expect(sceneShotAt(storyboard, 5_000)).toBe("stand");
    expect(sceneShotAt(storyboard, 5_500)).toBe("remaining");
    expect(remainingCameraProgressAt(storyboard, 5_000)).toBe(0);
    expect(remainingCameraProgressAt(storyboard, 5_500)).toBeGreaterThan(0);
    expect(remainingCameraProgressAt(storyboard, 5_700)).toBe(1);
    expect(remainingCameraProgressAt(storyboard, 6_000)).toBe(1);
  });

  it("uses a distant forecast, stable stand framing, and tighter remaining-cups view", () => {
    expect(sceneCameraComposition(360, 740, "forecast").mode).toBe("portrait");
    expect(sceneCameraComposition(768, 740, "stand").mode).toBe("balanced");
    expect(sceneCameraComposition(844, 390, "remaining").mode).toBe("wide");

    const portraitForecast = sceneCameraComposition(360, 740, "forecast");
    const portraitStand = sceneCameraComposition(360, 740, "stand");
    const portraitRemaining = sceneCameraComposition(360, 740, "remaining");

    expect(portraitForecast.position[1]).toBeGreaterThan(portraitStand.position[1]);
    expect(portraitForecast.position[2]).toBeGreaterThan(portraitStand.position[2]);
    expect(portraitStand.position[2]).toBeGreaterThanOrEqual(22);
    expect(portraitStand.fov).toBeGreaterThanOrEqual(50);
    expect(portraitRemaining.position[2]).toBeGreaterThanOrEqual(13);
    expect(portraitStand.position[2]).toBeGreaterThan(portraitRemaining.position[2]);
    expect(portraitForecast.lookAt[2]).toBeLessThan(portraitStand.lookAt[2]);
    expect(portraitRemaining.lookAt[2]).toBeGreaterThanOrEqual(1);
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
