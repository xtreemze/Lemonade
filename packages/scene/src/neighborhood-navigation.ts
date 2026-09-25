import type {
  NeighborhoodSidewalkSegment,
  NeighborhoodTopology,
} from "./neighborhood-topology.js";
import { generateNeighborhoodTopology } from "./neighborhood-topology.js";
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
  sidewalkSegmentId?: string;
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

const pointDistance = (
  left: Pick<NavigationNode, "x" | "z">,
  right: Pick<NavigationNode, "x" | "z">,
): number => Math.hypot(right.x - left.x, right.z - left.z);

const topologySideToLegacySide = (
  sidewalk: NeighborhoodSidewalkSegment,
): SidewalkSide | null => {
  if (sidewalk.streetId !== "main") {
    return null;
  }
  return sidewalk.side === -1 ? "near" : "far";
};

const sidewalkEndpointId = (
  sidewalk: NeighborhoodSidewalkSegment,
  endpoint: "start" | "end",
): string => `${sidewalk.id}:${endpoint}`;

const createSidewalkEndpoint = (
  sidewalk: NeighborhoodSidewalkSegment,
  endpoint: "start" | "end",
): NavigationNode => {
  const position = endpoint === "start" ? sidewalk.start : sidewalk.end;
  return Object.freeze({
    id: sidewalkEndpointId(sidewalk, endpoint),
    x: position.x,
    z: position.z,
    role: "sidewalk",
    side: topologySideToLegacySide(sidewalk),
    sidewalkSegmentId: sidewalk.id,
  });
};

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

const coordinateKey = (value: number): string => value.toFixed(2);

const junctionKey = (node: Pick<NavigationNode, "x" | "z">): string =>
  `${coordinateKey(node.x)}:${coordinateKey(node.z)}`;

const connectCoincidentEndpoints = (
  nodes: readonly NavigationNode[],
  edges: NavigationEdge[],
): void => {
  const groups = new Map<string, NavigationNode[]>();
  for (const node of nodes) {
    if (node.role !== "sidewalk") {
      continue;
    }
    const key = junctionKey(node);
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        if (
          left === undefined ||
          right === undefined ||
          left.sidewalkSegmentId === right.sidewalkSegmentId
        ) {
          continue;
        }
        addBidirectionalEdge(edges, left, right, "sidewalk");
      }
    }
  }
};

const nearestNode = (
  nodes: readonly NavigationNode[],
  point: ResidentialPoint,
  predicate: (node: NavigationNode) => boolean,
): NavigationNode => {
  const candidates = nodes.filter(predicate);
  const first = candidates[0];
  if (first === undefined) {
    throw new Error("navigation graph has no matching sidewalk node");
  }
  return candidates.reduce(
    (best, candidate) =>
      pointDistance(candidate, point) < pointDistance(best, point) ? candidate : best,
    first,
  );
};

const createTopologyNavigationGraph = (
  topology: NeighborhoodTopology,
): NeighborhoodNavigationGraph => {
  const nodes = topology.sidewalks.flatMap((sidewalk) => [
    createSidewalkEndpoint(sidewalk, "start"),
    createSidewalkEndpoint(sidewalk, "end"),
  ]);
  const edges: NavigationEdge[] = [];

  for (const sidewalk of topology.sidewalks) {
    const start = findNode(nodes, sidewalkEndpointId(sidewalk, "start"));
    const end = findNode(nodes, sidewalkEndpointId(sidewalk, "end"));
    addBidirectionalEdge(edges, start, end, "sidewalk");
  }

  connectCoincidentEndpoints(nodes, edges);

  const mainNearNodes = nodes.filter(
    (node) => node.role === "sidewalk" && node.side === "near",
  );
  const mainFarNodes = nodes.filter(
    (node) => node.role === "sidewalk" && node.side === "far",
  );
  const crossingXs = topology.roads
    .filter((road) => road.streetId !== "main")
    .flatMap((road) => [road.start.x, road.end.x])
    .filter((x) => x >= -120 && x <= 120);

  for (const x of crossingXs) {
    const near = nearestNode(
      mainNearNodes,
      { x, z: STREET_LAYOUT.nearSidewalk.centerZ },
      () => true,
    );
    const far = nearestNode(
      mainFarNodes,
      { x, z: STREET_LAYOUT.farSidewalk.centerZ },
      () => true,
    );
    const alreadyConnected = edges.some(
      (edge) => edge.from === near.id && edge.to === far.id && edge.kind === "crossing",
    );
    if (!alreadyConnected) {
      addBidirectionalEdge(edges, near, far, "crossing");
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
  const mutableNodes = [...nodes, standEntry, standService];
  const nearCenter = nearestNode(
    nodes,
    { x: standEntry.x, z: STREET_LAYOUT.nearSidewalk.centerZ },
    (node) => node.side === "near",
  );
  addBidirectionalEdge(edges, nearCenter, standEntry, "stand-access");
  addBidirectionalEdge(edges, standEntry, standService, "stand-access");

  return Object.freeze({
    nodes: Object.freeze(mutableNodes),
    edges: Object.freeze(edges),
    standEntryNodeId: standEntry.id,
    standServiceNodeId: standService.id,
  });
};

export const createNeighborhoodNavigationGraph = (
  layout: ResidentialLayout,
): NeighborhoodNavigationGraph =>
  createTopologyNavigationGraph(generateNeighborhoodTopology(layout.seed));

export const createNeighborhoodNavigationGraphFromTopology = (
  topology: NeighborhoodTopology,
): NeighborhoodNavigationGraph => createTopologyNavigationGraph(topology);

export const navigationNode = (
  graph: NeighborhoodNavigationGraph,
  nodeId: string,
): NavigationNode => findNode(graph.nodes, nodeId);

export const nearestSidewalkNode = (
  graph: NeighborhoodNavigationGraph,
  point: ResidentialPoint,
  side: SidewalkSide,
): NavigationNode =>
  nearestNode(graph.nodes, point, (node) => node.role === "sidewalk" && node.side === side);

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
