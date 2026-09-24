import type { ResidentialLayout, ResidentialPoint } from "./residential-layout.js";
import { type SidewalkSide, STREET_LAYOUT } from "./street-layout.js";

export type NavigationNodeRole = "sidewalk" | "stand-entry" | "stand-service";

export type NavigationEdgeKind = "sidewalk" | "crossing" | "stand-access";

export type NavigationNode = Readonly<{
  id: string;
  x: number;
  z: number;
  role: NavigationNodeRole;
  side: SidewalkSide | null;
}>;

export type NavigationEdge = Readonly<{
  from: string;
  to: string;
  cost: number;
  kind: NavigationEdgeKind;
}>;

export type NeighborhoodNavigationGraph = Readonly<{
  nodes: readonly NavigationNode[];
  edges: readonly NavigationEdge[];
  standEntryNodeId: string;
  standServiceNodeId: string;
}>;

const coordinateKey = (value: number): string => value.toFixed(3);

const sidewalkNodeId = (side: SidewalkSide, x: number): string =>
  `sidewalk:${side}:${coordinateKey(x)}`;

const pointDistance = (
  left: Pick<NavigationNode, "x" | "z">,
  right: Pick<NavigationNode, "x" | "z">,
): number => Math.hypot(right.x - left.x, right.z - left.z);

const distinctSorted = (values: readonly number[]): readonly number[] =>
  Object.freeze(
    [...new Set(values.map((value) => Number(value.toFixed(3))))].sort(
      (left, right) => left - right,
    ),
  );

const verticalRoadCenters = (layout: ResidentialLayout): readonly number[] =>
  distinctSorted(
    layout.exclusions
      .filter((rect) => rect.role === "road" && rect.maxX - rect.minX < rect.maxZ - rect.minZ)
      .map((rect) => (rect.minX + rect.maxX) / 2),
  );

const sidewalkAnchors = (layout: ResidentialLayout): readonly number[] =>
  distinctSorted([
    -60,
    0,
    60,
    ...verticalRoadCenters(layout),
    ...layout.frontProperties.map((property) => Math.max(-60, Math.min(60, property.houseX))),
  ]);

const addDirectedEdge = (
  edges: NavigationEdge[],
  from: NavigationNode,
  to: NavigationNode,
  kind: NavigationEdgeKind,
): void => {
  edges.push(
    Object.freeze({
      from: from.id,
      to: to.id,
      cost: pointDistance(from, to),
      kind,
    }),
  );
};

const addBidirectionalEdge = (
  edges: NavigationEdge[],
  left: NavigationNode,
  right: NavigationNode,
  kind: NavigationEdgeKind,
): void => {
  addDirectedEdge(edges, left, right, kind);
  addDirectedEdge(edges, right, left, kind);
};

const findNode = (nodes: readonly NavigationNode[], id: string): NavigationNode => {
  const node = nodes.find((candidate) => candidate.id === id);
  if (node === undefined) {
    throw new Error(`navigation node not found: ${id}`);
  }
  return node;
};

export const createNeighborhoodNavigationGraph = (
  layout: ResidentialLayout,
): NeighborhoodNavigationGraph => {
  const anchors = sidewalkAnchors(layout);
  const nodes: NavigationNode[] = [];

  for (const side of ["near", "far"] as const) {
    const sidewalk = side === "near" ? STREET_LAYOUT.nearSidewalk : STREET_LAYOUT.farSidewalk;
    for (const x of anchors) {
      nodes.push(
        Object.freeze({
          id: sidewalkNodeId(side, x),
          x,
          z: sidewalk.centerZ,
          role: "sidewalk",
          side,
        }),
      );
    }
  }

  const standEntry = Object.freeze({
    id: "stand:entry",
    x: 0,
    z: STREET_LAYOUT.nearSidewalk.minZ - 0.2,
    role: "stand-entry" as const,
    side: "near" as const,
  });
  const standService = Object.freeze({
    id: "stand:service",
    x: 0,
    z: STREET_LAYOUT.nearSidewalk.minZ - 0.95,
    role: "stand-service" as const,
    side: "near" as const,
  });
  nodes.push(standEntry, standService);

  const edges: NavigationEdge[] = [];
  for (const side of ["near", "far"] as const) {
    const sideNodes = nodes
      .filter((node) => node.role === "sidewalk" && node.side === side)
      .sort((left, right) => left.x - right.x);
    for (let index = 0; index < sideNodes.length - 1; index += 1) {
      const left = sideNodes[index];
      const right = sideNodes[index + 1];
      if (left !== undefined && right !== undefined) {
        addBidirectionalEdge(edges, left, right, "sidewalk");
      }
    }
  }

  for (const x of verticalRoadCenters(layout)) {
    const near = findNode(nodes, sidewalkNodeId("near", x));
    const far = findNode(nodes, sidewalkNodeId("far", x));
    addBidirectionalEdge(edges, near, far, "crossing");
  }

  const nearCenter = findNode(nodes, sidewalkNodeId("near", 0));
  addBidirectionalEdge(edges, nearCenter, standEntry, "stand-access");
  addBidirectionalEdge(edges, standEntry, standService, "stand-access");

  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    standEntryNodeId: standEntry.id,
    standServiceNodeId: standService.id,
  });
};

export const navigationNode = (
  graph: NeighborhoodNavigationGraph,
  nodeId: string,
): NavigationNode => findNode(graph.nodes, nodeId);

export const nearestSidewalkNode = (
  graph: NeighborhoodNavigationGraph,
  point: ResidentialPoint,
  side: SidewalkSide,
): NavigationNode => {
  const candidates = graph.nodes.filter((node) => node.role === "sidewalk" && node.side === side);
  const first = candidates[0];
  if (first === undefined) {
    throw new Error(`navigation graph has no ${side} sidewalk nodes`);
  }

  return candidates.reduce(
    (best, candidate) =>
      Math.hypot(candidate.x - point.x, candidate.z - point.z) <
      Math.hypot(best.x - point.x, best.z - point.z)
        ? candidate
        : best,
    first,
  );
};

export const shortestNavigationPath = (
  graph: NeighborhoodNavigationGraph,
  startNodeId: string,
  endNodeId: string,
): readonly string[] => {
  navigationNode(graph, startNodeId);
  navigationNode(graph, endNodeId);

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const unvisited = new Set(graph.nodes.map((node) => node.id));

  for (const node of graph.nodes) {
    distances.set(node.id, node.id === startNodeId ? 0 : Number.POSITIVE_INFINITY);
  }

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        currentId = nodeId;
        currentDistance = distance;
      }
    }

    if (currentId === null || !Number.isFinite(currentDistance)) {
      break;
    }
    if (currentId === endNodeId) {
      break;
    }
    unvisited.delete(currentId);

    for (const edge of graph.edges) {
      if (edge.from !== currentId || !unvisited.has(edge.to)) {
        continue;
      }
      const candidateDistance = currentDistance + edge.cost;
      const knownDistance = distances.get(edge.to) ?? Number.POSITIVE_INFINITY;
      if (candidateDistance >= knownDistance) {
        continue;
      }
      distances.set(edge.to, candidateDistance);
      previous.set(edge.to, currentId);
    }
  }

  if (startNodeId !== endNodeId && !previous.has(endNodeId)) {
    return Object.freeze([]);
  }

  const reversed = [endNodeId];
  let current = endNodeId;
  while (current !== startNodeId) {
    const parent = previous.get(current);
    if (parent === undefined) {
      return Object.freeze([]);
    }
    reversed.push(parent);
    current = parent;
  }

  return Object.freeze(reversed.reverse());
};

export const navigationPathPoints = (
  graph: NeighborhoodNavigationGraph,
  nodeIds: readonly string[],
): readonly ResidentialPoint[] =>
  Object.freeze(
    nodeIds.map((nodeId) => {
      const node = navigationNode(graph, nodeId);
      return Object.freeze({ x: node.x, z: node.z });
    }),
  );
