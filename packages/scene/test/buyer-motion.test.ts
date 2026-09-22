import { describe, expect, it } from "vitest";

import {
  BUYER_WALK_SPEED,
  buyerMotionPoseAt,
} from "../src/buyer-motion.js";
import { STREET_LAYOUT } from "../src/street-layout.js";
import type { SaleBeat } from "../src/storyboard.js";

const sale = Object.freeze({
  saleNumber: 1,
  buyerIndex: 0,
  approachAtMs: 1_000,
  purchaseAtMs: 2_500,
  purchaseEndAtMs: 2_700,
  drinkEndAtMs: 3_100,
  departAtMs: 4_600,
  direction: -1,
  lane: 3,
  remainingCups: 11,
}) satisfies SaleBeat;

describe("buyer motion", () => {
  it("approaches the stand from the sidewalk instead of crossing from top or bottom", () => {
    const start = buyerMotionPoseAt(sale, "approaching", sale.approachAtMs);
    const middle = buyerMotionPoseAt(sale, "approaching", 1_750);
    const end = buyerMotionPoseAt(sale, "approaching", sale.purchaseAtMs);

    for (const pose of [start, middle, end]) {
      expect(pose.z).toBeGreaterThanOrEqual(STREET_LAYOUT.nearSidewalk.minZ);
      expect(pose.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
      expect(Math.abs(pose.x)).toBeLessThan(6);
    }
    expect(start.x).toBeLessThan(end.x);
    expect(start.z).toBeGreaterThanOrEqual(end.z);
  });

  it("keeps approach and departure movement at normal walking speed", () => {
    const assertWalkingSpeed = (
      phase: "approaching" | "departing",
      startMs: number,
      endMs: number,
    ): void => {
      let previous = buyerMotionPoseAt(sale, phase, startMs);
      for (let elapsedMs = startMs + 100; elapsedMs <= endMs; elapsedMs += 100) {
        const current = buyerMotionPoseAt(sale, phase, elapsedMs);
        const distance = Math.hypot(
          current.x - previous.x,
          current.z - previous.z,
        );
        expect(distance).toBeLessThanOrEqual(BUYER_WALK_SPEED * 0.1 + 0.01);
        previous = current;
      }
    };

    assertWalkingSpeed("approaching", sale.approachAtMs, sale.purchaseAtMs);
    assertWalkingSpeed("departing", sale.drinkEndAtMs, sale.departAtMs);
  });

  it("returns departing buyers to a sidewalk lane without pinning them at scene bounds", () => {
    const start = buyerMotionPoseAt(sale, "departing", sale.drinkEndAtMs);
    const end = buyerMotionPoseAt(sale, "departing", sale.departAtMs);

    expect(end.x).toBeGreaterThan(start.x);
    expect(end.z).toBeGreaterThanOrEqual(STREET_LAYOUT.nearSidewalk.minZ);
    expect(end.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
    expect(Math.abs(end.x)).toBeLessThan(6);
  });
});
