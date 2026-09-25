import {
  generateNeighborhoodTopology,
  type NeighborhoodRoadSegment,
  type NeighborhoodSidewalkSegment,
  type NeighborhoodTopology,
} from "./neighborhood-topology.js";
import type { ResidentialLayout, ResidentialPoint } from "./residential-layout.js";
import { type SidewalkSide, STREET_LAYOUT, sidewalkSideForZ } from "./street-layout.js";

export type NavigationNodeRole = "sidewalk" | "stand-entry" | "stand-service";

export type NavigationEdgeKind = "sidewalk" | "crossing" | "stand-access";

export type NavigationNode = Readonly<{
  id: string;
  x: number;
  z: number;
  role: NavigationNodeRole;
  side: SidewalkSide | null;
  streetId: string | null;
  segmentId: string | null;
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

type SegmentEndpoint = "start" | "end";

const pointDistance = (
  left: Pick<NavigationNode, "x" | "z">,
  right: Pick<NavigationNode, "x" | "z">,
): number => Math.hypot(right.x - left.x, right.z - left.z);

const pointDistanceTo = (left: Pick<NavigationNode, "x" | "z">, right: ResidentialPoint): number =>
  Math.hypot(right.x - left.x, right.z - left.z);

const sidewalkNodeId = (segment: NeighborhoodSidewalkSegment, endpoint: SegmentEndpoint): string =>
  `navigation:${segment.id}:${endpoint}`;

const sidewalkSide = (segment: NeighborhoodSidewalkSegment): SidewalkSide | null =>
  segment.streetId === "main" ? sidewalkSideForZ(segment.center.z) : null;

const sidewalkNode = (
  segment: NeighborhoodSidewalkSegment,
  endpoint: SegmentEndpoint,
): NavigationNode => {
  const position = endpoint === "start" ? segment.start : segment.end;
  return Object.freeze({
    id: sidewalkNodeId(segment, endpoint),
    x: position.x,
    z: position.z,
    role: "sidewalk",
    side: sidewalkSide(segment),
    streetId: segment.streetId,
    segmentId: segment.id,
  });
};

const addDirectedEdge = (
  edges: NavigationEdge[],
  from: NavigationNode,
  to: NavigationNode,
  kind: NavigationEdgeKind,
): void => {
  const duplicate = edges.some(
    (edge) => edge.from === from.id && edge.to === to.id && edge.kind === kind,
  );
  if (duplicate) {
    return;
  }

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

const addSegmentNodes = (
  nodes: NavigationNode[],
  edges: NavigationEdge[],
  segment: NeighborhoodSidewalkSegment,
): void => {
  const start = sidewalkNode(segment, "start");
  const end = sidewalkNode(segment, "end");
  nodes.push(start, end);
  addBidirectionalEdge(edges, start, end, "sidewalk");
};

const roadSegmentIndex = (segment: NeighborhoodSidewalkSegment): number =>
  Math.floor(segment.segmentIndex / 2);

const connectStreetContinuity = (
  topology: NeighborhoodTopology,
  nodes: readonly NavigationNode[],
  edges: NavigationEdge[],
): void => {
  const streetIds = [...new Set(topology.sidewalks.map((segment) => segment.streetId))].sort();

  for (const streetId of streetIds) {
    for (const localSide of [-1, 1] as const) {
      const segments = topology.sidewalks
        .filter((segment) => segment.streetId === streetId && segment.side === localSide)
        .sort((left, right) => roadSegmentIndex(left) - roadSegmentIndex(right));

      for (let index = 1; index < segments.length; index += 1) {
        const previous = segments[index - 1];
        const current = segments[index];
        if (previous === undefined || current === undefined) {
          continue;
        }

        const previousEnd = findNode(nodes, sidewalkNodeId(previous, "end"));
        const currentStart = findNode(nodes, sidewalkNodeId(current, "start"));
        const kind =
          roadSegmentIndex(current) - roadSegmentIndex(previous) === 1 ? "sidewalk" : "crossing";
        addBidirectionalEdge(edges, previousEnd, currentStart, kind);
      }
    }
  }
};

const segmentIntersection = (
  first: NeighborhoodRoadSegment,
  second: NeighborhoodRoadSegment,
): ResidentialPoint | null => {
  const firstX = first.end.x - first.start.x;
  const firstZ = first.end.z - first.start.z;
  const secondX = second.end.x - second.start.x;
  const secondZ = second.end.z - second.start.z;
  const denominator = firstX * secondZ - firstZ * secondX;
  if (Math.abs(denominator) < 0.000_001) {
    return null;
  }

  const deltaX = second.start.x - first.start.x;
  const deltaZ = second.start.z - first.start.z;
  const firstProgress = (deltaX * secondZ - deltaZ * secondX) / denominator;
  const secondProgress = (deltaX * firstZ - deltaZ * firstX) / denominator;
  if (firstProgress < 0 || firstProgress > 1 || secondProgress < 0 || secondProgress > 1) {
    return null;
  }

  return Object.freeze({
    x: first.start.x + firstX * firstProgress,
    z: first.start.z + firstZ * firstProgress,
  });
};

const mainStreetIntersections = (topology: NeighborhoodTopology): readonly ResidentialPoint[] => {
  const main = topology.roads.filter((road) => road.streetId === "main");
  const others = topology.roads.filter((road) => road.streetId !== "main");
  const intersections: ResidentialPoint[] = [];
  const keys = new Set<string>();

  for (const mainSegment of main) {
    for (const other of others) {
      const point = segmentIntersection(mainSegment, other);
      if (point === null) {
        continue;
      }
      const key = `${point.x.toFixed(3)}:${point.z.toFixed(3)}`;
      if (keys.has(key)) {
        continue;
      }
      keys.add(key);
      intersections.push(point);
    }
  }

  return Object.freeze(intersections);
};

const nearestNode = (nodes: readonly NavigationNode[], point: ResidentialPoint): NavigationNode => {
  const first = nodes[0];
  if (first === undefined) {
    throw new Error("navigation graph has no candidate sidewalk nodes");
  }

  return nodes.reduce(
    (best, candidate) =>
      pointDistanceTo(candidate, point) < pointDistanceTo(best, point) ? candidate : best,
    first,
  );
};

const addMainCrossings = (
  topology: NeighborhoodTopology,
  nodes: readonly NavigationNode[],
  edges: NavigationEdge[],
): void => {
  const near = nodes.filter((node) => node.role === "sidewalk" && node.side === "near");
  const far = nodes.filter((node) => node.role === "sidewalk" && node.side === "far");

  for (const intersection of mainStreetIntersections(topology)) {
    addBidirectionalEdge(
      edges,
      nearestNode(near, intersection),
      nearestNode(far, intersection),
      "crossing",
    );
  }
};

const standNodes = (): readonly [NavigationNode, NavigationNode] => {
  const entry = Object.freeze({
    id: "stand:entry",
    x: 0,
    z: STREET_LAYOUT.nearSidewalk.minZ - 0.2,
    role: "stand-entry" as const,
    side: "near" as const,
    streetId: null,
    segmentId: null,
  });
  const service = Object.freeze({
    id: "stand:service",
    x: 0,
    z: STREET_LAYOUT.nearSidewalk.minZ - 0.95,
    role: "stand-service" as const,
    side: "near" as const,
    streetId: null,
    segmentId: null,
  });
  return Object.freeze([entry, service]);
};

export const createNeighborhoodNavigationGraphFromTopology = (
  topology: NeighborhoodTopology,
): NeighborhoodNavigationGraph => {
  const nodes: NavigationNode[] = [];
  const edges: NavigationEdge[] = [];

  for (const segment of topology.sidewalks) {
    addSegmentNodes(nodes, edges, segment);
  }
  connectStreetContinuity(topology, nodes, edges);
  addMainCrossings(topology, nodes, edges);

  const [standEntry, standService] = standNodes();
  nodes.push(standEntry, standService);
  const nearMainNodes = nodes.filter(
    (node) => node.role === "sidewalk" && node.side === "near" && node.streetId === "main",
  );
  addBidirectionalEdge(edges, nearestNode(nearMainNodes, standEntry), standEntry, "stand-access");
  addBidirectionalEdge(edges, standEntry, standService, "stand-access");

  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    standEntryNodeId: standEntry.id,
    standServiceNodeId: standService.id,
  });
};

export const createNeighborhoodNavigationGraph = (
  layout: Pick<ResidentialLayout, "seed">,
): NeighborhoodNavigationGraph =>
  createNeighborhoodNavigationGraphFromTopology(generateNeighborhoodTopology(layout.seed));

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
      pointDistanceTo(candidate, point) < pointDistanceTo(best, point) ? candidate : best,
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
