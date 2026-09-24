import {
  type NavigationNode,
  type NeighborhoodNavigationGraph,
  shortestNavigationPath,
} from "./neighborhood-navigation.js";
import type { SidewalkSide } from "./street-layout.js";

export type AuthoritativeCustomerOutcome = Readonly<{
  id: number;
  visualSeed: number;
  awareness:
    | Readonly<{ kind: "unaware" }>
    | Readonly<{ kind: "organic" }>
    | Readonly<{ kind: "advertising"; signIndex: number }>;
  conversion:
    | Readonly<{ kind: "not-evaluated" }>
    | Readonly<{ kind: "price-rejected" }>
    | Readonly<{ kind: "willing" }>;
  fulfillment:
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "purchased"; saleIndex: number }>
    | Readonly<{ kind: "stockout" }>;
}>;

export type CrowdIntentKind = "pass-through" | "price-reject" | "purchase" | "stockout";

export type CrowdSimulationDetail = "full" | "reduced" | "statistical";

export type CrowdIntent = Readonly<{
  customerId: number;
  visualSeed: number;
  kind: CrowdIntentKind;
  signIndex: number | null;
  saleIndex: number | null;
  routeNodeIds: readonly string[];
}>;

export type CrowdDirector = Readonly<{
  intents: readonly CrowdIntent[];
}>;

const validateOutcome = (outcome: AuthoritativeCustomerOutcome): void => {
  if (!Number.isSafeInteger(outcome.id) || outcome.id < 0) {
    throw new RangeError("customer id must be a non-negative safe integer");
  }

  if (outcome.awareness.kind === "unaware") {
    if (outcome.conversion.kind !== "not-evaluated" || outcome.fulfillment.kind !== "none") {
      throw new RangeError("unaware customer cannot evaluate price or receive fulfillment");
    }
    return;
  }

  if (outcome.conversion.kind === "not-evaluated") {
    throw new RangeError("aware customer must evaluate price");
  }

  if (outcome.conversion.kind === "price-rejected") {
    if (outcome.fulfillment.kind !== "none") {
      throw new RangeError("price-rejected customer cannot be fulfilled");
    }
    return;
  }

  if (outcome.fulfillment.kind === "none") {
    throw new RangeError("willing customer must purchase or encounter stockout");
  }
};

const sideForCustomer = (customerId: number): SidewalkSide =>
  customerId % 2 === 0 ? "near" : "far";

const directionForCustomer = (customerId: number): -1 | 1 =>
  Math.floor(customerId / 2) % 2 === 0 ? 1 : -1;

const sidewalkTerminals = (
  graph: NeighborhoodNavigationGraph,
  side: SidewalkSide,
): readonly [NavigationNode, NavigationNode] => {
  const nodes = graph.nodes
    .filter((node) => node.role === "sidewalk" && node.side === side)
    .sort((left, right) => left.x - right.x);
  const first = nodes[0];
  const last = nodes.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error(`navigation graph has no ${side} sidewalk terminals`);
  }
  return [first, last] as const;
};

const appendPath = (base: readonly string[], next: readonly string[]): readonly string[] => {
  if (base.length === 0) {
    return Object.freeze([...next]);
  }
  if (next.length === 0) {
    return Object.freeze([...base]);
  }
  return Object.freeze([...base, ...(base.at(-1) === next[0] ? next.slice(1) : next)]);
};

const routeForOutcome = (
  graph: NeighborhoodNavigationGraph,
  outcome: AuthoritativeCustomerOutcome,
): readonly string[] => {
  const side = sideForCustomer(outcome.id);
  const direction = directionForCustomer(outcome.id);
  const [left, right] = sidewalkTerminals(graph, side);
  const start = direction === 1 ? left : right;
  const end = direction === 1 ? right : left;

  if (outcome.awareness.kind === "unaware") {
    return shortestNavigationPath(graph, start.id, end.id);
  }

  const target =
    outcome.conversion.kind === "price-rejected"
      ? graph.standEntryNodeId
      : graph.standServiceNodeId;
  const inbound = shortestNavigationPath(graph, start.id, target);
  const outbound = shortestNavigationPath(graph, target, end.id);
  return appendPath(inbound, outbound);
};

const intentKind = (outcome: AuthoritativeCustomerOutcome): CrowdIntentKind => {
  if (outcome.awareness.kind === "unaware") {
    return "pass-through";
  }
  if (outcome.conversion.kind === "price-rejected") {
    return "price-reject";
  }
  if (outcome.fulfillment.kind === "purchased") {
    return "purchase";
  }
  return "stockout";
};

export const createCrowdDirector = (
  outcomes: readonly AuthoritativeCustomerOutcome[],
  graph: NeighborhoodNavigationGraph,
): CrowdDirector => {
  const intents = outcomes.map((outcome): CrowdIntent => {
    validateOutcome(outcome);
    return Object.freeze({
      customerId: outcome.id,
      visualSeed: outcome.visualSeed,
      kind: intentKind(outcome),
      signIndex: outcome.awareness.kind === "advertising" ? outcome.awareness.signIndex : null,
      saleIndex: outcome.fulfillment.kind === "purchased" ? outcome.fulfillment.saleIndex : null,
      routeNodeIds: routeForOutcome(graph, outcome),
    });
  });

  return Object.freeze({ intents: Object.freeze(intents) });
};

export const crowdSimulationDetailForDistance = (distance: number): CrowdSimulationDetail => {
  const safeDistance = Math.max(0, Number.isFinite(distance) ? distance : 0);
  if (safeDistance <= 18) {
    return "full";
  }
  if (safeDistance <= 45) {
    return "reduced";
  }
  return "statistical";
};
