import { seed, type Seed } from "./primitives.js";

export interface RandomSource {
  nextUnit(): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
}

export type SeedDerivationPart = string | number;

const mixSeedWord = (state: number, word: number): number => {
  let value = (state ^ word) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0_aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a_2d97);
  return (value ^ (value >>> 15)) >>> 0;
};

export const deriveSeed = (
  initialSeed: Seed,
  ...parts: readonly SeedDerivationPart[]
): Seed => {
  let state = mixSeedWord(Number(initialSeed) >>> 0, 0x4c45_4d4f);

  for (const part of parts) {
    if (typeof part === "number") {
      if (!Number.isSafeInteger(part)) {
        throw new RangeError("numeric seed derivation parts must be safe integers");
      }
      state = mixSeedWord(state, 0x4e55_4d42);
      state = mixSeedWord(state, part >>> 0);
      state = mixSeedWord(state, Math.floor(part / 0x1_0000_0000) >>> 0);
      continue;
    }

    state = mixSeedWord(state, 0x5354_5247);
    state = mixSeedWord(state, part.length);
    for (let index = 0; index < part.length; index += 1) {
      state = mixSeedWord(state, part.charCodeAt(index));
    }
  }

  return seed(state);
};

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

export const createNamedRandom = (
  initialSeed: Seed,
  ...parts: readonly SeedDerivationPart[]
): RandomSource => createSeededRandom(deriveSeed(initialSeed, ...parts));
