declare const brand: unique symbol;

type Brand<Value, Name extends string> = Value & {
  readonly [brand]: Name;
};

export type MoneyCents = Brand<number, "MoneyCents">;
export type SignedMoneyCents = Brand<number, "SignedMoneyCents">;
export type GlassCount = Brand<number, "GlassCount">;
export type SignCount = Brand<number, "SignCount">;
export type DayNumber = Brand<number, "DayNumber">;
export type Seed = Brand<number, "Seed">;
export type BasisPoints = Brand<number, "BasisPoints">;

const requireSafeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
};

const requireNonNegativeInteger = (value: number, name: string): void => {
  requireSafeInteger(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
};

export const moneyCents = (value: number): MoneyCents => {
  requireNonNegativeInteger(value, "money cents");
  return value as MoneyCents;
};

export const signedMoneyCents = (value: number): SignedMoneyCents => {
  requireSafeInteger(value, "signed money cents");
  return value as SignedMoneyCents;
};

export const glassCount = (value: number): GlassCount => {
  requireNonNegativeInteger(value, "glass count");
  return value as GlassCount;
};

export const signCount = (value: number): SignCount => {
  requireNonNegativeInteger(value, "sign count");
  return value as SignCount;
};

export const dayNumber = (value: number): DayNumber => {
  requireSafeInteger(value, "day number");
  if (value < 1) {
    throw new RangeError("day number must be at least 1");
  }
  return value as DayNumber;
};

export const seed = (value: number): Seed => {
  requireNonNegativeInteger(value, "seed");
  if (value > 0xffff_ffff) {
    throw new RangeError("seed must fit in an unsigned 32-bit integer");
  }
  return value as Seed;
};

export const basisPoints = (value: number): BasisPoints => {
  requireNonNegativeInteger(value, "basis points");
  if (value > 100_000) {
    throw new RangeError("basis points exceed supported simulation range");
  }
  return value as BasisPoints;
};
