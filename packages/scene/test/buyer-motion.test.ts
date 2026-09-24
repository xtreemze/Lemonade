import { describe, expect, it } from "vitest";

import { BUYER_WALK_SPEED, buyerMotionAt } from "../src/buyer-motion.js";
import { STAND_WORLD_Z } from "../src/stand-anchors.js";
import type { SaleBeat } from "../src/storyboard.js";
import { STREET_LAYOUT } from "../src/street-layout.js";

const sale: SaleBeat = Object.freeze({
  saleNumber: 1,
  buyerIndex: 0,
  approachAtMs: 0,
  purchaseAtMs: 2000,
  purchaseEndAtMs: 2200,
  drinkEndAtMs: 2700,
  departAtMs: 4700,
  direction: -1,
  lane: 1,
  remainingCups: 9,
});

describe("buyer motion", () => {
  it("approaches from the sidewalk instead of entering from the top or bottom", () => {
    const streetZ = STREET_LAYOUT.nearSidewalk.centerZ;
    const start = buyerMotionAt(sale, sale.approachAtMs, streetZ);
    const service = buyerMotionAt(sale, sale.purchaseAtMs, streetZ);

    expect(start).toBeDefined();
    expect(service).toBeDefined();
    if (start === undefined || service === undefined) {
      return;
    }

    expect(start.z).toBeGreaterThanOrEqual(STREET_LAYOUT.nearSidewalk.minZ);
    expect(start.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
    expect(Math.abs(start.x)).toBeGreaterThan(Math.abs(service.x));
    expect(service.z).toBeGreaterThan(STAND_WORLD_Z + 0.6);
    expect(service.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
  });

  it("keeps approach and departure displacement aligned with walking speed", () => {
    const streetZ = STREET_LAYOUT.nearSidewalk.centerZ;

    for (const [startMs, endMs] of [
      [sale.approachAtMs, sale.purchaseAtMs],
      [sale.drinkEndAtMs, sale.departAtMs],
    ] as const) {
      let previous = buyerMotionAt(sale, startMs, streetZ);
      for (let elapsedMs = startMs + 100; elapsedMs <= endMs; elapsedMs += 100) {
        const current = buyerMotionAt(sale, elapsedMs, streetZ);
        expect(current).toBeDefined();
        if (previous === undefined || current === undefined) {
          continue;
        }
        const displacement = Math.hypot(current.x - previous.x, current.z - previous.z);
        expect(displacement).toBeLessThanOrEqual(BUYER_WALK_SPEED * 0.1 + 0.035);
        previous = current;
      }
    }
  });

  it("returns departing buyers to the sidewalk before they continue along it", () => {
    const streetZ = STREET_LAYOUT.nearSidewalk.centerZ;
    const halfway = buyerMotionAt(
      sale,
      sale.drinkEndAtMs + (sale.departAtMs - sale.drinkEndAtMs) * 0.5,
      streetZ,
    );
    const end = buyerMotionAt(sale, sale.departAtMs, streetZ);

    expect(halfway).toBeDefined();
    expect(end).toBeDefined();
    if (halfway === undefined || end === undefined) {
      return;
    }

    expect(halfway.z).toBeGreaterThanOrEqual(STAND_WORLD_Z + 0.6);
    expect(end.z).toBeCloseTo(streetZ, 6);
    expect(end.z).toBeGreaterThanOrEqual(STREET_LAYOUT.nearSidewalk.minZ);
    expect(end.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
  });
});
