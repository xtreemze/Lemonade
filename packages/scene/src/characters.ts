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
  eyeSpacing: number;
  headWidthScale: number;
  headHeightScale: number;
}>;

const clothes = [
  0xd7_5c_51, 0x50_7d_83, 0xe0_a4_3c, 0x77_66_a6, 0x3f_7d_68, 0x9c_5b_72, 0x3f_6f_9f, 0xbf_70_48,
] as const;
const skins = [0xf0_c7_a5, 0xe1_ad_83, 0xc9_8c_65, 0x9b_64_48, 0x70_49_36] as const;
const hairs = [0x2f_23_1e, 0x5a_39_26, 0x81_5a_33, 0x27_28_2c, 0xa0_6d_3d] as const;
const trousers = [0x3f_46_50, 0x6c_59_48, 0x46_5b_72, 0x57_48_5f, 0x3f_5b_4f] as const;

const mix = (seed: number, index: number): number => {
  let value = ((seed >>> 0) ^ Math.imul((index + 1) >>> 0, 0x9e_37_79_b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21_f0_aa_ad);
  value = Math.imul(value ^ (value >>> 15), 0x73_5a_2d_97);
  return (value ^ (value >>> 15)) >>> 0;
};

const pick = <T>(values: readonly T[], value: number): T => {
  const selected = values[value % values.length];
  if (selected === undefined) {
    throw new Error("character palette invariant failed");
  }
  return selected;
};

export const characterProfileFor = (seed: number, index: number): CharacterProfile => {
  const actorIndex = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  const identity = mix(seed, actorIndex);
  const secondary = mix(identity, actorIndex + 31);
  const child = actorIndex < 10_000 && Math.floor(actorIndex / 2) % 3 === 2;
  return Object.freeze({
    clothingColor: pick(clothes, identity),
    skinColor: pick(skins, identity >>> 3),
    hairColor: pick(hairs, identity >>> 7),
    trouserColor: pick(trousers, identity >>> 11),
    hairStyle: ((identity >>> 15) & 3) as 0 | 1 | 2 | 3,
    accessory: ((identity >>> 17) % 3) as 0 | 1 | 2,
    heightScale: child ? 0.66 + ((identity >>> 19) & 7) / 46 : 0.9 + ((identity >>> 19) & 15) / 75,
    widthScale: child ? 0.82 + ((identity >>> 23) & 7) / 54 : 0.9 + ((identity >>> 23) & 7) / 44,
    walkPace: (child ? 1 : 0.88) + ((secondary >>> 3) & 15) / 58,
    gaitAmplitude: 0.48 + ((secondary >>> 8) & 7) / 35,
    strideOffset: (secondary / 0xff_ff_ff_ff) * Math.PI * 2,
    eyeSpacing: 0.078 + ((secondary >>> 13) & 7) / 230,
    headWidthScale: 0.9 + ((secondary >>> 17) & 7) / 42,
    headHeightScale: 0.94 + ((secondary >>> 21) & 7) / 36,
  });
};
