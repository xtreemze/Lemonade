import { describe, expect, it } from "vitest";

import {
  createSeededRandom,
  dayNumber,
  generateNeighborhoodOccurrences,
  seed,
  type NeighborhoodSemanticLayout,
} from "../src/index.js";

const layout: NeighborhoodSemanticLayout = Object.freeze({
  householdCount: 6,
  drivewayHouseholds: Object.freeze([0, 2, 4]),
  frontYardHouseholds: Object.freeze([0, 1, 2, 3, 4, 5]),
  mailboxHouseholds: Object.freeze([0, 1, 2, 3, 4, 5]),
});

const schedule = (
  day: number,
  weather: "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm" = "sunny",
) =>
  generateNeighborhoodOccurrences({
    runSeed: seed(0x4c45_4d4f),
    day: dayNumber(day),
    weather,
    layout,
  });

describe("neighborhood occurrence ledger", () => {
  it("is deterministic, ordered, bounded to a day, and presentation-only", () => {
    const first = schedule(3);
    const repeated = schedule(3);

    expect(repeated).toEqual(first);
    expect(first.length).toBeGreaterThan(0);

    for (let index = 0; index < first.length; index += 1) {
      const occurrence = first[index];
      expect(occurrence).toBeDefined();
      if (occurrence === undefined) continue;

      expect(occurrence.startMinute).toBeGreaterThanOrEqual(0);
      expect(occurrence.endMinute).toBeGreaterThan(occurrence.startMinute);
      expect(occurrence.endMinute).toBeLessThanOrEqual(1_440);
      expect(occurrence.economicEffect).toBe("none");

      const previous = first[index - 1];
      if (previous !== undefined) {
        expect(occurrence.startMinute).toBeGreaterThanOrEqual(
          previous.startMinute,
        );
      }
    }
  });

  it("schedules mail as a morning route over semantic mailboxes", () => {
    const occurrences = schedule(2, "cloudy");
    const mail = occurrences.filter(
      (occurrence) => occurrence.kind === "mail-delivery",
    );

    expect(mail).toHaveLength(layout.mailboxHouseholds.length);
    expect(
      mail.every(
        (occurrence) =>
          occurrence.startMinute >= 8 * 60 &&
          occurrence.endMinute <= 11 * 60 &&
          occurrence.anchors.some((anchor) => anchor.role === "mailbox"),
      ),
    ).toBe(true);
  });

  it("schedules gardening on exactly one weekday in each seven-day cycle", () => {
    const gardeningDays = Array.from({ length: 7 }, (_, index) => index + 1)
      .filter((day) =>
        schedule(day).some((occurrence) => occurrence.kind === "gardening"),
      );

    expect(gardeningDays).toHaveLength(1);
    const gardening = schedule(gardeningDays[0] ?? 1).find(
      (occurrence) => occurrence.kind === "gardening",
    );
    expect(gardening?.startMinute).toBeGreaterThanOrEqual(7 * 60);
    expect(gardening?.endMinute).toBeLessThanOrEqual(9 * 60 + 25);
  });

  it("allows sprinklers only for sunny or hot-and-dry mornings", () => {
    const sunny = schedule(4, "sunny").filter(
      (occurrence) => occurrence.kind === "sprinkler",
    );
    const hot = schedule(4, "hot-and-dry").filter(
      (occurrence) => occurrence.kind === "sprinkler",
    );
    const cloudy = schedule(4, "cloudy").filter(
      (occurrence) => occurrence.kind === "sprinkler",
    );
    const storm = schedule(4, "thunderstorm").filter(
      (occurrence) => occurrence.kind === "sprinkler",
    );

    expect(sunny.length).toBeGreaterThan(0);
    expect(hot.length).toBeGreaterThan(0);
    expect(cloudy).toHaveLength(0);
    expect(storm).toHaveLength(0);
    expect(
      [...sunny, ...hot].every(
        (occurrence) =>
          occurrence.startMinute >= 6 * 60 &&
          occurrence.endMinute <= 9 * 60,
      ),
    ).toBe(true);
  });

  it("keeps household departures before paired arrivals", () => {
    const occurrences = schedule(5, "thunderstorm");

    for (let household = 0; household < layout.householdCount; household += 1) {
      const departures = occurrences.filter(
        (occurrence) =>
          occurrence.kind === "resident-departure" &&
          occurrence.household === household,
      );
      const arrivals = occurrences.filter(
        (occurrence) =>
          occurrence.kind === "resident-arrival" &&
          occurrence.household === household,
      );

      if (departures.length === 0 || arrivals.length === 0) continue;
      expect(departures).toHaveLength(1);
      expect(arrivals).toHaveLength(1);
      expect(departures[0]?.endMinute).toBeLessThan(
        arrivals[0]?.startMinute ?? 0,
      );
    }
  });

  it("keeps pass-through car traffic active across the business-day simulation", () => {
    const traffic = schedule(3, "sunny").filter(
      (occurrence) => occurrence.kind === "vehicle-pass-through",
    );
    expect(traffic.length).toBeGreaterThanOrEqual(20);
    expect(
      traffic.every(
        (occurrence) =>
          occurrence.household === null &&
          occurrence.actorKind === "vehicle" &&
          occurrence.startMinute >= 9 * 60 + 30 &&
          occurrence.endMinute <= 18 * 60 &&
          occurrence.endMinute - occurrence.startMinute >= 38 &&
          occurrence.anchors.some((anchor) => anchor.role === "crossing"),
      ),
    ).toBe(true);

    const coveredHalfHours = new Set(
      traffic.flatMap((occurrence) => {
        const buckets: number[] = [];
        for (
          let minute = occurrence.startMinute;
          minute < occurrence.endMinute;
          minute += 30
        ) {
          buckets.push(Math.floor((minute - (9 * 60 + 30)) / 30));
        }
        return buckets;
      }),
    );
    expect(coveredHalfHours.size).toBeGreaterThanOrEqual(12);
  });

  it("scales bicycle traffic with weather while keeping useful visible windows", () => {
    const sunny = schedule(6, "sunny").filter(
      (occurrence) => occurrence.kind === "bicycle-pass-through",
    );
    const cloudy = schedule(6, "cloudy").filter(
      (occurrence) => occurrence.kind === "bicycle-pass-through",
    );
    const storm = schedule(6, "thunderstorm").filter(
      (occurrence) => occurrence.kind === "bicycle-pass-through",
    );

    expect(sunny.length).toBeGreaterThan(cloudy.length);
    expect(cloudy.length).toBeGreaterThan(0);
    expect(storm).toHaveLength(0);
    expect(
      [...sunny, ...cloudy].every(
        (occurrence) =>
          occurrence.endMinute - occurrence.startMinute >= 35 &&
          occurrence.endMinute <= 18 * 60,
      ),
    ).toBe(true);
  });

  it("does not perturb customer-market RNG streams", () => {
    const before = createSeededRandom(seed(99)).nextUnit();

    schedule(8, "sunny");

    const after = createSeededRandom(seed(99)).nextUnit();

    expect(after).toBe(before);
  });

  it("rejects semantic layout slots outside the household range", () => {
    expect(() =>
      generateNeighborhoodOccurrences({
        runSeed: seed(1),
        day: dayNumber(1),
        weather: "sunny",
        layout: {
          ...layout,
          drivewayHouseholds: [layout.householdCount],
        },
      }),
    ).toThrow(/household/i);
  });
});
