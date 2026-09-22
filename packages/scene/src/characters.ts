export type CharacterProfile = Readonly<{
  clothingColor: number;
  skinColor: number;
  hairColor: number;
  trouserColor: number;
  hairStyle: 0 | 1 | 2 | 3;
  accessory: 0 | 1 | 2;
  heightScale: number;
  widthScale: number;
  walkPace: number;
  gaitAmplitude: number;
  strideOffset: number;
}>;

const clothingPalette = [
  0xd75c51,
  0x507d83,
  0xe0a43c,
  0x7766a6,
  0x3f7d68,
  0x9c5b72,
  0x3f6f9f,
  0xbf7048,
] as const;

const skinPalette = [0xf0c7a5, 0xe1ad83, 0xc98c65, 0x9b6448, 0x704936] as const;
const hairPalette = [0x2f231e, 0x5a3926, 0x815a33, 0x27282c, 0xa06d3d] as const;
const trouserPalette = [0x3f4650, 0x6c5948, 0x465b72, 0x57485f, 0x3f5b4f] as const;

const mix32 = (value: number): number => {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
};

const sample = (seed: number, index: number, channel: number): number =>
  mix32((seed >>> 0) ^ Math.imul((index + 1) >>> 0, 0x9e3779b1) ^ Math.imul(channel, 0x85ebca6b));

const choose = <T>(values: readonly T[], value: number): T => {
  const selected = values[value % values.length];
  if (selected === undefined) throw new Error("character palette invariant failed");
  return selected;
};

const unit = (value: number): number => (value >>> 0) / 0xffff_ffff;

export const characterProfileFor = (seed: number, index: number): CharacterProfile => {
  const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  const clothing = sample(seed, safeIndex, 1);
  const skin = sample(seed, safeIndex, 2);
  const hair = sample(seed, safeIndex, 3);
  const trousers = sample(seed, safeIndex, 4);
  const proportions = sample(seed, safeIndex, 5);
  const movement = sample(seed, safeIndex, 6);
  const details = sample(seed, safeIndex, 7);

  return Object.freeze({
    clothingColor: choose(clothingPalette, clothing),
    skinColor: choose(skinPalette, skin),
    hairColor: choose(hairPalette, hair),
    trouserColor: choose(trouserPalette, trousers),
    hairStyle: (hair % 4) as 0 | 1 | 2 | 3,
    accessory: (details % 3) as 0 | 1 | 2,
    heightScale: 0.9 + unit(proportions) * 0.2,
    widthScale: 0.9 + unit(mix32(proportions ^ 0xa5a5_a5a5)) * 0.16,
    walkPace: 0.88 + unit(movement) * 0.26,
    gaitAmplitude: 0.48 + unit(mix32(movement ^ 0x5a5a_5a5a)) * 0.2,
    strideOffset: unit(sample(seed, safeIndex, 8)) * Math.PI * 2,
  });
};
