import { describe, expect, it } from "vitest";

import {
  completedSalesAt,
  createStreetStoryboard,
  remainingCupsAt,
} from "../src/storyboard.js";

describe("street simulation storyboard", () => {
  it("maps every sale to a buyer and one inventory decrement", () => {
    const storyboard = createStreetStoryboard({
      durationMs: 5_000,
      prepared: 20,
      sold: 7,
      visibleSigns: 3,
      ambientPedestrianCount: 10,
    });

    expect(storyboard.durationMs).toBe(5_000);
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

    expect(completedSalesAt(storyboard, firstSale.purchaseAtMs - 1)).toBe(0);
    expect(completedSalesAt(storyboard, firstSale.purchaseAtMs)).toBe(1);
    expect(completedSalesAt(storyboard, lastSale.purchaseAtMs)).toBe(7);
    expect(remainingCupsAt(storyboard, lastSale.purchaseAtMs)).toBe(13);
  });

  it("keeps non-buyers more numerous and assigns ad viewers only when signs exist", () => {
    const advertised = createStreetStoryboard({
      durationMs: 5_000,
      prepared: 60,
      sold: 18,
      visibleSigns: 5,
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
      durationMs: 5_000,
      prepared: 60,
      sold: 18,
      visibleSigns: 0,
      ambientPedestrianCount: 12,
    });

    expect(unadvertised.passersBy.length).toBeGreaterThan(unadvertised.sales.length);
    expect(unadvertised.adViewerCount).toBe(0);
    expect(unadvertised.passersBy.some((pedestrian) => pedestrian.seesAdvertisement)).toBe(false);
  });

  it("is deterministic and never schedules more sales than prepared cups", () => {
    const input = {
      durationMs: 5_000,
      prepared: 8,
      sold: 12,
      visibleSigns: 2,
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
