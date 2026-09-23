import { generateResidentialLayout } from "./residential-layout.js";

export type SceneNeighborhoodAnchorRole =
  | "residence"
  | "door"
  | "front-path"
  | "sidewalk"
  | "driveway"
  | "parking"
  | "mailbox"
  | "front-yard"
  | "back-yard"
  | "street"
  | "crossing";

export type SceneNeighborhoodOccurrenceKind =
  | "resident-departure"
  | "resident-arrival"
  | "vehicle-departure"
  | "vehicle-arrival"
  | "pet-walk"
  | "mail-delivery"
  | "gardening"
  | "sprinkler"
  | "window-activity"
  | "bicycle-pass-through";

export type SceneNeighborhoodOccurrence = Readonly<{
  id: string;
  kind: SceneNeighborhoodOccurrenceKind;
  actorKind: string;
  actorId: string;
  household: number | null;
  startMinute: number;
  endMinute: number;
  anchors: readonly Readonly<{
    role: SceneNeighborhoodAnchorRole;
    household: number | null;
  }>[];
  visualSeed: number;
  motion: "stationary" | "normal" | "relaxed" | "hurried";
  economicEffect: "none";
}>;

export type SceneNeighborhoodSemanticLayout = Readonly<{
  householdCount: number;
  drivewayHouseholds: readonly number[];
  frontYardHouseholds: readonly number[];
  mailboxHouseholds: readonly number[];
}>;

export const NEIGHBORHOOD_SEED_SALT = 0x4c45_4d4f;

export const neighborhoodSeedForCharacterSeed = (
  characterSeed: number,
): number => (Math.trunc(characterSeed) ^ NEIGHBORHOOD_SEED_SALT) >>> 0;

export const neighborhoodSemanticLayoutForCharacterSeed = (
  characterSeed: number,
): SceneNeighborhoodSemanticLayout => {
  const layout = generateResidentialLayout(
    neighborhoodSeedForCharacterSeed(characterSeed),
  );
  const properties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ];

  return Object.freeze({
    householdCount: properties.length,
    drivewayHouseholds: Object.freeze(
      properties.flatMap((property, index) =>
        property.drivewayX === null ? [] : [index],
      ),
    ),
    frontYardHouseholds: Object.freeze(
      properties.map((_, index) => index),
    ),
    mailboxHouseholds: Object.freeze(
      properties.flatMap((property, index) =>
        property.mailboxX === null ? [] : [index],
      ),
    ),
  });
};

export const phaseMinuteAt = (
  phase: "idle" | "forecast" | "simulation",
  elapsedMs: number,
  durationMs: number,
): number => {
  const progress = Math.min(
    1,
    Math.max(0, elapsedMs / Math.max(1, durationMs)),
  );

  const [start, end] =
    phase === "forecast"
      ? [6 * 60 + 30, 9 * 60 + 30]
      : phase === "simulation"
        ? [9 * 60 + 30, 18 * 60]
        : [18 * 60, 24 * 60];

  return Math.round(start + (end - start) * progress);
};

export const activeNeighborhoodOccurrences = (
  occurrences: readonly SceneNeighborhoodOccurrence[],
  phase: "idle" | "forecast" | "simulation",
  elapsedMs: number,
  durationMs: number,
): readonly SceneNeighborhoodOccurrence[] => {
  const minute = phaseMinuteAt(phase, elapsedMs, durationMs);
  return Object.freeze(
    occurrences.filter(
      (occurrence) =>
        occurrence.startMinute <= minute && minute < occurrence.endMinute,
    ),
  );
};
