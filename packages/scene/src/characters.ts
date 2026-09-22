export type CharacterAgeGroup = "adult" | "child";
export type CharacterGenderPresentation = "female" | "male";
export type CharacterExpression = "bright" | "calm" | "curious" | "serious";

export type CharacterProfile = Readonly<{
  clothingColor: number;
  skinColor: number;
  hairColor: number;
  trouserColor: number;
  hairStyle: 0 | 1 | 2 | 3 | 4;
  accessory: 0 | 1 | 2;
  outfitStyle: 0 | 1 | 2 | 3;
  ageGroup: CharacterAgeGroup;
  genderPresentation: CharacterGenderPresentation;
  expression: CharacterExpression;
  heightScale: number;
  widthScale: number;
  walkPace: number;
  gaitAmplitude: number;
  strideOffset: number;
  eyeSpacing: number;
  headWidthScale: number;
  headHeightScale: number;
}>;

const clothes = [0xd75c51, 0x507d83, 0xe0a43c, 0x7766a6, 0x3f7d68, 0x9c5b72, 0x3f6f9f, 0xbf7048] as const;
const skins = [0xf0c7a5, 0xe1ad83, 0xc98c65, 0x9b6448, 0x704936] as const;
const hairs = [0x2f231e, 0x5a3926, 0x815a33, 0x27282c, 0xa06d3d] as const;
const trousers = [0x3f4650, 0x6c5948, 0x465b72, 0x57485f, 0x3f5b4f] as const;
const expressions = ["bright", "calm", "curious", "serious"] as const;

const mix = (seed: number, index: number): number => {
  let value = ((seed >>> 0) ^ Math.imul((index + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
};

const pick = <T>(values: readonly T[], value: number): T => {
  const selected = values[value % values.length];
  if (selected === undefined) throw new Error("character palette invariant failed");
  return selected;
};

export const characterProfileFor = (seed: number, index: number): CharacterProfile => {
  const normalizedIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  const identity = mix(seed, normalizedIndex);
  const secondary = mix(identity, normalizedIndex + 31);
  const demographic = ((normalizedIndex % 4) + 4) % 4;
  const ageGroup: CharacterAgeGroup = demographic >= 2 ? "child" : "adult";
  const genderPresentation: CharacterGenderPresentation =
    demographic % 2 === 0 ? "male" : "female";
  const heightScale =
    ageGroup === "child"
      ? 0.66 + ((identity >>> 19) & 15) / 150
      : 0.9 + ((identity >>> 19) & 15) / 75;
  const widthScale =
    ageGroup === "child"
      ? 0.82 + ((identity >>> 23) & 7) / 70
      : 0.9 + ((identity >>> 23) & 7) / 44;

  return Object.freeze({
    clothingColor: pick(clothes, identity),
    skinColor: pick(skins, identity >>> 3),
    hairColor: pick(hairs, identity >>> 7),
    trouserColor: pick(trousers, identity >>> 11),
    hairStyle: ((identity >>> 15) % 5) as 0 | 1 | 2 | 3 | 4,
    accessory: ((identity >>> 18) % 3) as 0 | 1 | 2,
    outfitStyle: ((identity >>> 20) % 4) as 0 | 1 | 2 | 3,
    ageGroup,
    genderPresentation,
    expression: pick(expressions, secondary >>> 2),
    heightScale,
    widthScale,
    walkPace: 0.88 + ((secondary >>> 3) & 15) / 58,
    gaitAmplitude: 0.48 + ((secondary >>> 8) & 7) / 35,
    strideOffset: (secondary / 0xffff_ffff) * Math.PI * 2,
    eyeSpacing: 0.078 + ((secondary >>> 13) & 7) / 230,
    headWidthScale: 0.9 + ((secondary >>> 17) & 7) / 42,
    headHeightScale: 0.94 + ((secondary >>> 21) & 7) / 36,
  });
};
