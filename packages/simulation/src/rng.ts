import type { Seed } from "./primitives.js";

export interface RandomSource {
  nextUnit(): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
}

export const createSeededRandom = (initialSeed: Seed): RandomSource => {
  let state = Number(initialSeed) >>> 0;

  const nextUnit = (): number => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  const nextInt = (minInclusive: number, maxExclusive: number): number => {
    if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxExclusive)) {
      throw new RangeError("random integer bounds must be safe integers");
    }
    if (maxExclusive <= minInclusive) {
      throw new RangeError("random integer range must be non-empty");
    }
    return minInclusive + Math.floor(nextUnit() * (maxExclusive - minInclusive));
  };

  return Object.freeze({ nextUnit, nextInt });
};
