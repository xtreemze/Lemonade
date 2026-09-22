import { describe, expect, it } from "vitest";

import {
  BUYER_WALK_SPEED,
  buyerMotionAt,
} from "../src/buyer-motion.js";
import { STAND_WORLD_Z } from "../src/stand-anchors.js";
import { standCounterBounds } from "../src/stand-layout.js";
import {
  STREET_LAYOUT,
  sidewalkLaneZ,
} from "../src/street-layout.js";
import type { BuyerPhase, SaleBeat } from "../src/storyboard.js";

const saleFor = (direction: -1 | 1): SaleBeat =>
  Object.freeze({
    saleNumber: direction === -1 ? 1 : 2,
    buyerIndex: direction === -1 ? 0 : 1,
    approachAtMs: 1_000,
    purchaseAtMs: 2_600,
    purchaseEndAtMs: 2_800,
    drinkEndAtMs: 3_200,
    departAtMs: 4_800,
    direction,
    lane: direction === -1 ? 0 : 3,
    remainingCups: 8,
  });

const phaseSamples = (
  sale: SaleBeat,
  phase: Extract<BuyerPhase, "approaching" | "departing">,
  startMs: number,
  endMs: number,
  streetZ: number,
): readonly ReturnType<typeof buyerMotionAt>[] =>
  Object.freeze(
    Array.from({ length: Math.floor((endMs - startMs) / 100) + 1 }, (_, index) =>
      buyerMotionAt(
        sale,
        phase,
        Math.min(endMs, startMs + index * 100),
        streetZ,
      ),
    ),
  );

describe("buyer pedestrian motion", () => {
  it("approaches from the near sidewalk instead of entering from scene depth", () => {
    for (const direction of [-1, 1] as const) {
      const sale = saleFor(direction);
      const streetZ = sidewalkLaneZ(sale.lane);
      const start = buyerMotionAt(
        sale,
        "approaching",
        sale.approachAtMs,
        streetZ,
      );
      const service = buyerMotionAt(
        sale,
        "approaching",
        sale.purchaseAtMs,
        streetZ,
      );

      expect(start.z).toBeCloseTo(streetZ, 8);
      expect(start.z).toBeGreaterThanOrEqual(STREET_LAYOUT.nearSidewalk.minZ);
      expect(start.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
      expect(Math.abs(start.z - service.z)).toBeLessThan(1.5);
      expect(direction === -1 ? start.x < service.x : start.x > service.x).toBe(
        true,
      );
    }
  });

  it("keeps drinking-to-departure transitions continuous without cross-street snapping", () => {
    for (const direction of [-1, 1] as const) {
      const sale = saleFor(direction);
      const streetZ = sidewalkLaneZ(sale.lane);
      const drinkingEnd = buyerMotionAt(
        sale,
        "drinking",
        sale.drinkEndAtMs,
        streetZ,
      );
      const departureStart = buyerMotionAt(
        sale,
        "departing",
        sale.drinkEndAtMs,
        streetZ,
      );
      const departureEnd = buyerMotionAt(
        sale,
        "departing",
        sale.departAtMs,
        streetZ,
      );

      expect(departureStart.x).toBeCloseTo(drinkingEnd.x, 8);
      expect(departureStart.z).toBeCloseTo(drinkingEnd.z, 8);
      expect(departureEnd.z).toBeCloseTo(streetZ, 8);
      expect(departureEnd.z).toBeLessThan(STREET_LAYOUT.road.minZ);
    }
  });

  it("moves at normal walking speed without clamp-induced stationary intervals", () => {
    for (const direction of [-1, 1] as const) {
      const sale = saleFor(direction);
      const streetZ = sidewalkLaneZ(sale.lane);
      for (const [phase, startMs, endMs] of [
        ["approaching", sale.approachAtMs, sale.purchaseAtMs],
        ["departing", sale.drinkEndAtMs, sale.departAtMs],
      ] as const) {
        const poses = phaseSamples(sale, phase, startMs, endMs, streetZ);
        for (let index = 1; index < poses.length; index += 1) {
          const previous = poses[index - 1];
          const current = poses[index];
          if (previous === undefined || current === undefined) continue;
          const distance = Math.hypot(
            current.x - previous.x,
            current.z - previous.z,
          );
          expect(distance).toBeGreaterThan(0.01);
          expect(distance).toBeLessThanOrEqual(
            BUYER_WALK_SPEED * 0.1 + 0.002,
          );
        }
      }
    }
  });

  it("keeps the entire buyer path in front of the stand counter footprint", () => {
    const counter = standCounterBounds();
    const counterWorldMaxZ = STAND_WORLD_Z + counter.maxZ;

    for (const direction of [-1, 1] as const) {
      const sale = saleFor(direction);
      const streetZ = sidewalkLaneZ(sale.lane);
      for (const phase of [
        "approaching",
        "purchasing",
        "drinking",
        "departing",
      ] as const) {
        const phaseStart =
          phase === "approaching"
            ? sale.approachAtMs
            : phase === "purchasing"
              ? sale.purchaseAtMs
              : phase === "drinking"
                ? sale.purchaseEndAtMs
                : sale.drinkEndAtMs;
        const phaseEnd =
          phase === "approaching"
            ? sale.purchaseAtMs
            : phase === "purchasing"
              ? sale.purchaseEndAtMs
              : phase === "drinking"
                ? sale.drinkEndAtMs
                : sale.departAtMs;

        for (let elapsedMs = phaseStart; elapsedMs <= phaseEnd; elapsedMs += 100) {
          const pose = buyerMotionAt(sale, phase, elapsedMs, streetZ);
          expect(pose.z).toBeGreaterThan(counterWorldMaxZ + 0.3);
        }
      }
    }
  });
});
