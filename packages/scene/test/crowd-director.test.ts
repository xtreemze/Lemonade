import { describe, expect, it } from "vitest";

import {
  type AuthoritativeCustomerOutcome,
  createCrowdDirector,
  crowdSimulationDetailForDistance,
} from "../src/crowd-director.js";
import { createNeighborhoodNavigationGraph } from "../src/neighborhood-navigation.js";
import { generateResidentialLayout } from "../src/residential-layout.js";

const outcomes: readonly AuthoritativeCustomerOutcome[] = Object.freeze([
  Object.freeze({
    id: 0,
    visualSeed: 100,
    awareness: Object.freeze({ kind: "unaware" as const }),
    conversion: Object.freeze({ kind: "not-evaluated" as const }),
    fulfillment: Object.freeze({ kind: "none" as const }),
  }),
  Object.freeze({
    id: 1,
    visualSeed: 101,
    awareness: Object.freeze({
      kind: "advertising" as const,
      signIndex: 2,
    }),
    conversion: Object.freeze({ kind: "price-rejected" as const }),
    fulfillment: Object.freeze({ kind: "none" as const }),
  }),
  Object.freeze({
    id: 2,
    visualSeed: 102,
    awareness: Object.freeze({ kind: "organic" as const }),
    conversion: Object.freeze({ kind: "willing" as const }),
    fulfillment: Object.freeze({
      kind: "purchased" as const,
      saleIndex: 0,
    }),
  }),
  Object.freeze({
    id: 3,
    visualSeed: 103,
    awareness: Object.freeze({
      kind: "advertising" as const,
      signIndex: 1,
    }),
    conversion: Object.freeze({ kind: "willing" as const }),
    fulfillment: Object.freeze({ kind: "stockout" as const }),
  }),
]);

describe("authoritative crowd director", () => {
  it("projects economic outcomes into deterministic semantic intents", () => {
    const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(456));
    const first = createCrowdDirector(outcomes, graph);
    const repeated = createCrowdDirector(outcomes, graph);

    expect(repeated).toEqual(first);
    expect(first.intents.map((intent) => intent.kind)).toEqual([
      "pass-through",
      "price-reject",
      "purchase",
      "stockout",
    ]);
    expect(first.intents.map((intent) => intent.visualSeed)).toEqual([100, 101, 102, 103]);
  });

  it("only assigns a sign glance to advertising-aware customers", () => {
    const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(456));
    const director = createCrowdDirector(outcomes, graph);

    expect(director.intents[0]?.signIndex).toBeNull();
    expect(director.intents[1]?.signIndex).toBe(2);
    expect(director.intents[2]?.signIndex).toBeNull();
    expect(director.intents[3]?.signIndex).toBe(1);
  });

  it("routes price rejection to the stand edge and fulfillment to service", () => {
    const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(456));
    const director = createCrowdDirector(outcomes, graph);
    const rejected = director.intents[1];
    const purchased = director.intents[2];
    const stockout = director.intents[3];

    expect(rejected?.routeNodeIds).toContain(graph.standEntryNodeId);
    expect(rejected?.routeNodeIds).not.toContain(graph.standServiceNodeId);
    expect(purchased?.routeNodeIds).toContain(graph.standServiceNodeId);
    expect(stockout?.routeNodeIds).toContain(graph.standServiceNodeId);
    expect(purchased?.saleIndex).toBe(0);
    expect(stockout?.saleIndex).toBeNull();
  });

  it("crosses sidewalks when an authoritative far-side customer approaches", () => {
    const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(456));
    const director = createCrowdDirector(outcomes, graph);
    const rejected = director.intents[1];
    if (rejected === undefined) {
      throw new Error("expected rejected intent");
    }

    const routeEdges = rejected.routeNodeIds.slice(0, -1).map((nodeId, index) => {
      const next = rejected.routeNodeIds[index + 1];
      return graph.edges.find((edge) => edge.from === nodeId && edge.to === next);
    });
    expect(routeEdges.some((edge) => edge?.kind === "crossing")).toBe(true);
  });

  it("defines simulation LOD independently from rendering LOD", () => {
    expect(crowdSimulationDetailForDistance(10)).toBe("full");
    expect(crowdSimulationDetailForDistance(30)).toBe("reduced");
    expect(crowdSimulationDetailForDistance(70)).toBe("statistical");
    expect(crowdSimulationDetailForDistance(Number.POSITIVE_INFINITY)).toBe("full");
  });
});
