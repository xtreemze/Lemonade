import { describe, expect, it } from "vitest";

import { reclaimBuyerVisualPool } from "../src/buyer-visual-pool.js";

const makeBuyer = (visible = false): { root: { visible: boolean } } => ({
  root: { visible },
});

describe("buyer visual pool", () => {
  it("reclaims every pooled buyer between repeated simulation rounds", () => {
    const buyers = Array.from({ length: 12 }, () => makeBuyer());

    for (let round = 0; round < 24; round += 1) {
      const first = buyers[round % buyers.length];
      const second = buyers[(round * 5) % buyers.length];
      if (first !== undefined) {
        first.root.visible = true;
      }
      if (second !== undefined) {
        second.root.visible = true;
      }

      reclaimBuyerVisualPool(buyers);

      expect(buyers.every((buyer) => !buyer.root.visible)).toBe(true);
    }
  });

  it("preserves the bounded visual pool while reclaiming visibility", () => {
    const buyers = Array.from({ length: 6 }, () => makeBuyer(true));
    const identities = buyers.map((buyer) => buyer.root);

    reclaimBuyerVisualPool(buyers);

    expect(buyers).toHaveLength(6);
    expect(buyers.map((buyer) => buyer.root)).toEqual(identities);
    expect(buyers.every((buyer) => !buyer.root.visible)).toBe(true);
  });
});
