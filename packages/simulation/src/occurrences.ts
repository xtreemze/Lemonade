import type { Weather } from "./model.js";
import {
  seed,
  type DayNumber,
  type Seed,
} from "./primitives.js";
import { createSeededRandom, type RandomSource } from "./rng.js";

export type NeighborhoodAnchorRole =
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

export type NeighborhoodAnchorRef = Readonly<{
  role: NeighborhoodAnchorRole;
  household: number | null;
}>;

export type NeighborhoodOccurrenceKind =
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

export type NeighborhoodActorKind =
  | "resident"
  | "vehicle"
  | "pet"
  | "mail-carrier"
  | "gardener"
  | "sprinkler"
  | "household"
  | "bicycle";

export type NeighborhoodMotion = "stationary" | "normal" | "relaxed" | "hurried";

export type NeighborhoodOccurrence = Readonly<{
  id: string;
  kind: NeighborhoodOccurrenceKind;
  actorKind: NeighborhoodActorKind;
  actorId: string;
  household: number | null;
  startMinute: number;
  endMinute: number;
  anchors: readonly NeighborhoodAnchorRef[];
  visualSeed: Seed;
  motion: NeighborhoodMotion;
  economicEffect: "none";
}>;

export type NeighborhoodSemanticLayout = Readonly<{
  householdCount: number;
  drivewayHouseholds: readonly number[];
  frontYardHouseholds: readonly number[];
  mailboxHouseholds: readonly number[];
}>;

export type NeighborhoodOccurrenceInput = Readonly<{
  runSeed: Seed;
  day: DayNumber;
  weather: Weather["kind"];
  layout: NeighborhoodSemanticLayout;
}>;

type NeighborhoodRandomStream =
  | "commute"
  | "pet"
  | "mail"
  | "gardener"
  | "sprinkler"
  | "window"
  | "bicycle"
  | "visual";

const hashText = (initial: number, value: string): number => {
  let hash = initial >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  hash ^= 0xff;
  return hash >>> 0;
};

const deriveNeighborhoodSeed = (
  runSeed: Seed,
  stream: NeighborhoodRandomStream,
  day: DayNumber | null,
  scope: string,
): Seed => {
  let hash = 0x811c_9dc5;
  hash = hashText(hash, "neighborhood-occurrences-v1");
  hash = hashText(hash, String(Number(runSeed)));
  hash = hashText(hash, stream);
  hash = hashText(hash, day === null ? "-" : String(Number(day)));
  hash = hashText(hash, scope);
  return seed(hash);
};

const randomFor = (
  runSeed: Seed,
  stream: NeighborhoodRandomStream,
  day: DayNumber | null,
  scope: string,
): RandomSource =>
  createSeededRandom(deriveNeighborhoodSeed(runSeed, stream, day, scope));

const requireHouseholdSlot = (
  household: number,
  count: number,
  field: string,
): void => {
  if (
    !Number.isSafeInteger(household) ||
    household < 0 ||
    household >= count
  ) {
    throw new RangeError(
      `${field} household slot ${String(household)} is outside the household range`,
    );
  }
};

const validateUniqueSlots = (
  slots: readonly number[],
  count: number,
  field: string,
): void => {
  const seen = new Set<number>();
  for (const household of slots) {
    requireHouseholdSlot(household, count, field);
    if (seen.has(household)) {
      throw new RangeError(`${field} contains duplicate household slots`);
    }
    seen.add(household);
  }
};

const validateLayout = (layout: NeighborhoodSemanticLayout): void => {
  if (
    !Number.isSafeInteger(layout.householdCount) ||
    layout.householdCount < 0
  ) {
    throw new RangeError("household count must be a non-negative safe integer");
  }

  validateUniqueSlots(
    layout.drivewayHouseholds,
    layout.householdCount,
    "driveway",
  );
  validateUniqueSlots(
    layout.frontYardHouseholds,
    layout.householdCount,
    "front-yard",
  );
  validateUniqueSlots(
    layout.mailboxHouseholds,
    layout.householdCount,
    "mailbox",
  );
};

const anchor = (
  role: NeighborhoodAnchorRole,
  household: number | null,
): NeighborhoodAnchorRef => Object.freeze({ role, household });

const visualSeedFor = (
  runSeed: Seed,
  actorId: string,
): Seed =>
  deriveNeighborhoodSeed(runSeed, "visual", null, actorId);

const occurrence = (
  runSeed: Seed,
  value: Omit<
    NeighborhoodOccurrence,
    "visualSeed" | "economicEffect"
  >,
): NeighborhoodOccurrence => {
  if (
    !Number.isSafeInteger(value.startMinute) ||
    !Number.isSafeInteger(value.endMinute) ||
    value.startMinute < 0 ||
    value.endMinute > 1_440 ||
    value.endMinute <= value.startMinute
  ) {
    throw new RangeError("occurrence time window must fit within one day");
  }

  return Object.freeze({
    ...value,
    anchors: Object.freeze([...value.anchors]),
    visualSeed: visualSeedFor(runSeed, value.actorId),
    economicEffect: "none",
  });
};

const householdMotion = (
  weather: Weather["kind"],
): NeighborhoodMotion => {
  if (weather === "thunderstorm") return "hurried";
  if (weather === "sunny") return "relaxed";
  return "normal";
};

const residentOccurrences = (
  input: NeighborhoodOccurrenceInput,
): readonly NeighborhoodOccurrence[] => {
  const result: NeighborhoodOccurrence[] = [];
  const drivewaySet = new Set(input.layout.drivewayHouseholds);

  for (
    let household = 0;
    household < input.layout.householdCount;
    household += 1
  ) {
    const commute = randomFor(
      input.runSeed,
      "commute",
      input.day,
      String(household),
    );
    const active = commute.nextUnit() < 0.78;
    if (active) {
      const departureStart = 7 * 60 + commute.nextInt(0, 121);
      const arrivalStart = 16 * 60 + 30 + commute.nextInt(0, 151);
      const motion = householdMotion(input.weather);
      const residentId = `resident:${String(household)}`;

      result.push(
        occurrence(input.runSeed, {
          id: `day:${String(Number(input.day))}:resident-departure:${String(household)}`,
          kind: "resident-departure",
          actorKind: "resident",
          actorId: residentId,
          household,
          startMinute: departureStart,
          endMinute: departureStart + 12,
          anchors: [
            anchor("door", household),
            anchor("front-path", household),
            anchor("sidewalk", household),
          ],
          motion,
        }),
        occurrence(input.runSeed, {
          id: `day:${String(Number(input.day))}:resident-arrival:${String(household)}`,
          kind: "resident-arrival",
          actorKind: "resident",
          actorId: residentId,
          household,
          startMinute: arrivalStart,
          endMinute: arrivalStart + 12,
          anchors: [
            anchor("sidewalk", household),
            anchor("front-path", household),
            anchor("door", household),
          ],
          motion,
        }),
      );

      if (drivewaySet.has(household) && commute.nextUnit() < 0.58) {
        const vehicleId = `vehicle:${String(household)}`;
        result.push(
          occurrence(input.runSeed, {
            id: `day:${String(Number(input.day))}:vehicle-departure:${String(household)}`,
            kind: "vehicle-departure",
            actorKind: "vehicle",
            actorId: vehicleId,
            household,
            startMinute: departureStart + 8,
            endMinute: departureStart + 18,
            anchors: [
              anchor("parking", household),
              anchor("driveway", household),
              anchor("street", household),
            ],
            motion: "normal",
          }),
          occurrence(input.runSeed, {
            id: `day:${String(Number(input.day))}:vehicle-arrival:${String(household)}`,
            kind: "vehicle-arrival",
            actorKind: "vehicle",
            actorId: vehicleId,
            household,
            startMinute: Math.max(departureStart + 30, arrivalStart - 12),
            endMinute: arrivalStart,
            anchors: [
              anchor("street", household),
              anchor("driveway", household),
              anchor("parking", household),
            ],
            motion: "normal",
          }),
        );
      }
    }

    const windowRandom = randomFor(
      input.runSeed,
      "window",
      input.day,
      String(household),
    );
    if (windowRandom.nextUnit() < 0.7) {
      const start =
        windowRandom.nextUnit() < 0.45
          ? 11 * 60 + windowRandom.nextInt(0, 181)
          : 18 * 60 + windowRandom.nextInt(0, 121);
      result.push(
        occurrence(input.runSeed, {
          id: `day:${String(Number(input.day))}:window:${String(household)}`,
          kind: "window-activity",
          actorKind: "household",
          actorId: `household:${String(household)}`,
          household,
          startMinute: start,
          endMinute: Math.min(1_440, start + 30 + windowRandom.nextInt(0, 61)),
          anchors: [anchor("residence", household)],
          motion: "stationary",
        }),
      );
    }

    if (input.weather !== "thunderstorm") {
      const petRandom = randomFor(
        input.runSeed,
        "pet",
        input.day,
        String(household),
      );
      if (petRandom.nextUnit() < 0.34) {
        const morning = petRandom.nextUnit() < 0.5;
        const start = morning
          ? 6 * 60 + 30 + petRandom.nextInt(0, 121)
          : 17 * 60 + 30 + petRandom.nextInt(0, 121);
        result.push(
          occurrence(input.runSeed, {
            id: `day:${String(Number(input.day))}:pet-walk:${String(household)}`,
            kind: "pet-walk",
            actorKind: "pet",
            actorId: `pet:${String(household)}`,
            household,
            startMinute: start,
            endMinute: start + 20,
            anchors: [
              anchor("door", household),
              anchor("front-path", household),
              anchor("sidewalk", household),
            ],
            motion: input.weather === "sunny" ? "relaxed" : "normal",
          }),
        );
      }
    }
  }

  return Object.freeze(result);
};

const mailOccurrences = (
  input: NeighborhoodOccurrenceInput,
): readonly NeighborhoodOccurrence[] => {
  const mailboxes = input.layout.mailboxHouseholds;
  const count = mailboxes.length;
  if (count === 0) return Object.freeze([]);

  const result: NeighborhoodOccurrence[] = [];
  const base = 8 * 60 + 20;
  const span = 145;

  mailboxes.forEach((household, index) => {
    const random = randomFor(
      input.runSeed,
      "mail",
      input.day,
      String(household),
    );
    const start =
      base +
      Math.floor((index * span) / Math.max(1, count)) +
      random.nextInt(0, 5);
    result.push(
      occurrence(input.runSeed, {
        id: `day:${String(Number(input.day))}:mail:${String(household)}`,
        kind: "mail-delivery",
        actorKind: "mail-carrier",
        actorId: "mail-carrier",
        household,
        startMinute: start,
        endMinute: start + 4,
        anchors: [
          anchor("sidewalk", household),
          anchor("mailbox", household),
          anchor("sidewalk", household),
        ],
        motion: input.weather === "thunderstorm" ? "hurried" : "normal",
      }),
    );
  });

  return Object.freeze(result);
};

const gardenerOccurrence = (
  input: NeighborhoodOccurrenceInput,
): NeighborhoodOccurrence | null => {
  if (
    input.layout.frontYardHouseholds.length === 0 ||
    input.weather === "thunderstorm"
  ) {
    return null;
  }

  const weekdayRandom = randomFor(
    input.runSeed,
    "gardener",
    null,
    "weekly-cadence",
  );
  const gardenerWeekday = weekdayRandom.nextInt(0, 5);
  const dayIndex = (Number(input.day) - 1) % 7;
  if (dayIndex !== gardenerWeekday) return null;

  const week = Math.floor((Number(input.day) - 1) / 7);
  const weeklyRandom = randomFor(
    input.runSeed,
    "gardener",
    input.day,
    `week:${String(week)}`,
  );
  const households = input.layout.frontYardHouseholds;
  const household =
    households[weeklyRandom.nextInt(0, households.length)] ?? households[0];
  if (household === undefined) return null;

  const start = 9 * 60 + weeklyRandom.nextInt(0, 121);
  return occurrence(input.runSeed, {
    id: `day:${String(Number(input.day))}:gardening:${String(household)}`,
    kind: "gardening",
    actorKind: "gardener",
    actorId: "gardener",
    household,
    startMinute: start,
    endMinute: Math.min(13 * 60, start + weeklyRandom.nextInt(45, 91)),
    anchors: [
      anchor("sidewalk", household),
      anchor("front-yard", household),
    ],
    motion: "normal",
  });
};

const sprinklerOccurrences = (
  input: NeighborhoodOccurrenceInput,
): readonly NeighborhoodOccurrence[] => {
  if (
    input.weather !== "sunny" &&
    input.weather !== "hot-and-dry"
  ) {
    return Object.freeze([]);
  }

  const yards = input.layout.frontYardHouseholds;
  if (yards.length === 0) return Object.freeze([]);

  let selected = yards.filter((household) => {
    const random = randomFor(
      input.runSeed,
      "sprinkler",
      input.day,
      `select:${String(household)}`,
    );
    return random.nextUnit() < 0.42;
  });

  if (selected.length === 0) {
    const fallback = randomFor(
      input.runSeed,
      "sprinkler",
      input.day,
      "fallback",
    ).nextInt(0, yards.length);
    const household = yards[fallback];
    selected = household === undefined ? [] : [household];
  }

  return Object.freeze(
    selected.map((household) => {
      const random = randomFor(
        input.runSeed,
        "sprinkler",
        input.day,
        `time:${String(household)}`,
      );
      const start = 6 * 60 + random.nextInt(0, 91);
      return occurrence(input.runSeed, {
        id: `day:${String(Number(input.day))}:sprinkler:${String(household)}`,
        kind: "sprinkler",
        actorKind: "sprinkler",
        actorId: `sprinkler:${String(household)}`,
        household,
        startMinute: start,
        endMinute: start + random.nextInt(12, 26),
        anchors: [anchor("front-yard", household)],
        motion: "stationary",
      });
    }),
  );
};

const bicycleOccurrences = (
  input: NeighborhoodOccurrenceInput,
): readonly NeighborhoodOccurrence[] => {
  const count =
    input.weather === "sunny"
      ? 3
      : input.weather === "hot-and-dry"
        ? 2
        : input.weather === "cloudy"
          ? 1
          : 0;
  const result: NeighborhoodOccurrence[] = [];

  for (let index = 0; index < count; index += 1) {
    const random = randomFor(
      input.runSeed,
      "bicycle",
      input.day,
      String(index),
    );
    const start = 10 * 60 + random.nextInt(0, 8 * 60);
    result.push(
      occurrence(input.runSeed, {
        id: `day:${String(Number(input.day))}:bicycle:${String(index)}`,
        kind: "bicycle-pass-through",
        actorKind: "bicycle",
        actorId: `bicycle:${String(index)}`,
        household: null,
        startMinute: start,
        endMinute: start + 8,
        anchors: [
          anchor("street", null),
          anchor("crossing", null),
          anchor("street", null),
        ],
        motion: input.weather === "sunny" ? "relaxed" : "normal",
      }),
    );
  }

  return Object.freeze(result);
};

export const generateNeighborhoodOccurrences = (
  input: NeighborhoodOccurrenceInput,
): readonly NeighborhoodOccurrence[] => {
  validateLayout(input.layout);

  const result = [
    ...residentOccurrences(input),
    ...mailOccurrences(input),
    ...sprinklerOccurrences(input),
    ...bicycleOccurrences(input),
  ];
  const gardening = gardenerOccurrence(input);
  if (gardening !== null) result.push(gardening);

  result.sort(
    (left, right) =>
      left.startMinute - right.startMinute ||
      left.endMinute - right.endMinute ||
      left.id.localeCompare(right.id),
  );

  return Object.freeze(result);
};
