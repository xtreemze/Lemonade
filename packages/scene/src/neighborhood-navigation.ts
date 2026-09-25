import {
  generateNeighborhoodTopology,
  type NeighborhoodSidewalkSegment,
  type NeighborhoodTopology,
} from "./neighborhood-topology.js";
import type { ResidentialLayout, ResidentialPoint } from "./residential-layout.js";
import type { SidewalkSide } from "./street-layout.js";

export type NavigationNodeRole = "sidewalk" | "stand-entry" | "stand-service";

export type NavigationEdgeKind = "sidewalk" | "crossing" | "stand-access";

export type NavigationNode = Readonly<{
  id: string;
  x: number;
  z: number;
  role: NavigationNodeRole;
  side: SidewalkSide | null;
  streetId?: string;
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

const semanticSide = (side: NeighborhoodSidewalkSegment["side"]): SidewalkSide =>
  side === -1 ? "near" : "far";

const sidewalkNodeId = (segment: NeighborhoodSidewalkSegment): string => `nav:${segment.id}`;

const sidewalkNode = (segment: NeighborhoodSidewalkSegment): NavigationNode =>
  Object.freeze({
    id: sidewalkNodeId(segment),
    x: segment.center.x,
    z: segment.center.z,
    role: "sidewalk" as const,
    side: semanticSide(segment.side),
    streetId: segment.streetId,
    sidewalkSegmentId: segment.id,
  });

const addDirectedEdge = (
  edges: NavigationEdge[],
  from: NavigationNode,
  to: NavigationNode,
  kind: NavigationEdgeKind,
): void => {
  if (from.id === to.id) {
    return;
  }
  if (edges.some((edge) => edge.from === from.id && edge.to === to.id && edge.kind === kind)) {
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

const roadSegmentIndexForSidewalk = (segment: NeighborhoodSidewalkSegment): number =>
  Math.floor(segment.segmentIndex / 2);

const connectStreetSidewalks = (
  topology: NeighborhoodTopology,
  nodesBySegment: ReadonlyMap<string, NavigationNode>,
  edges: NavigationEdge[],
): void => {
  const groups = new Map<string, NeighborhoodSidewalkSegment[]>();

  for (const segment of topology.sidewalks) {
    const key = `${segment.streetId}:${String(segment.side)}`;
    const group = groups.get(key) ?? [];
    group.push(segment);
    groups.set(key, group);
  }

  for (const segments of groups.values()) {
    segments.sort(
      (left, right) => roadSegmentIndexForSidewalk(left) - roadSegmentIndexForSidewalk(right),
    );
    for (let index = 0; index < segments.length - 1; index += 1) {
      const left = segments[index];
      const right = segments[index + 1];
      if (left === undefined || right === undefined) {
        continue;
      }
      const leftNode = nodesBySegment.get(left.id);
      const rightNode = nodesBySegment.get(right.id);
      if (leftNode !== undefined && rightNode !== undefined) {
        addBidirectionalEdge(edges, leftNode, rightNode, "sidewalk");
      }
    }
  }
};

const connectJunctions = (
  topology: NeighborhoodTopology,
  nodesBySegment: ReadonlyMap<string, NavigationNode>,
  edges: NavigationEdge[],
): void => {
  const sidewalksByRoad = new Map<string, NeighborhoodSidewalkSegment[]>();
  for (const sidewalk of topology.sidewalks) {
    const group = sidewalksByRoad.get(sidewalk.parentRoadId) ?? [];
    group.push(sidewalk);
    sidewalksByRoad.set(sidewalk.parentRoadId, group);
  }

  for (const junction of topology.junctions) {
    const candidates = junction.roadSegmentIds.flatMap(
      (roadSegmentId) => sidewalksByRoad.get(roadSegmentId) ?? [],
    );
    const candidateNodes = candidates
      .map((segment) => nodesBySegment.get(segment.id))
      .filter((node): node is NavigationNode => node !== undefined);

    for (let leftIndex = 0; leftIndex < candidateNodes.length; leftIndex += 1) {
      const left = candidateNodes[leftIndex];
      if (left === undefined) {
        continue;
      }
      for (let rightIndex = leftIndex + 1; rightIndex < candidateNodes.length; rightIndex += 1) {
        const right = candidateNodes[rightIndex];
        if (right !== undefined) {
          addBidirectionalEdge(edges, left, right, "crossing");
        }
      }
    }
  }
};

const standNodes = (
  topology: NeighborhoodTopology,
  nodesBySegment: ReadonlyMap<string, NavigationNode>,
): Readonly<{
  sidewalk: NavigationNode;
  entry: NavigationNode;
  service: NavigationNode;
}> => {
  const mainNear = topology.sidewalks
    .filter((segment) => segment.streetId === "main" && segment.side === -1)
    .sort(
      (left, right) =>
        Math.hypot(left.center.x, left.center.z) - Math.hypot(right.center.x, right.center.z),
    )[0];
  if (mainNear === undefined) {
    throw new Error("navigation graph requires a near-side main-street sidewalk");
  }

  const sidewalk = nodesBySegment.get(mainNear.id);
  if (sidewalk === undefined) {
    throw new Error("navigation graph requires a projected stand sidewalk node");
  }

  const normalX = -Math.sin(mainNear.rotationY);
  const normalZ = Math.cos(mainNear.rotationY);
  const outwardX = normalX * mainNear.side;
  const outwardZ = normalZ * mainNear.side;
  const entryOffset = mainNear.width / 2 + 0.2;
  const serviceOffset = entryOffset + 0.75;

  const entry = Object.freeze({
    id: "stand:entry",
    x: mainNear.center.x + outwardX * entryOffset,
    z: mainNear.center.z + outwardZ * entryOffset,
    role: "stand-entry" as const,
    side: "near" as const,
  });
  const service = Object.freeze({
    id: "stand:service",
    x: mainNear.center.x + outwardX * serviceOffset,
    z: mainNear.center.z + outwardZ * serviceOffset,
    role: "stand-service" as const,
    side: "near" as const,
  });

  return Object.freeze({ sidewalk, entry, service });
};

export const createNeighborhoodNavigationGraphFromTopology = (
  topology: NeighborhoodTopology,
): NeighborhoodNavigationGraph => {
  const sidewalkNodes = topology.sidewalks.map(sidewalkNode);
  const nodesBySegment = new Map(
    sidewalkNodes.flatMap((node) =>
      node.sidewalkSegmentId === undefined ? [] : [[node.sidewalkSegmentId, node] as const],
    ),
  );
  const edges: NavigationEdge[] = [];

  connectStreetSidewalks(topology, nodesBySegment, edges);
  connectJunctions(topology, nodesBySegment, edges);

  const stand = standNodes(topology, nodesBySegment);
  const nodes = [...sidewalkNodes, stand.entry, stand.service];
  addBidirectionalEdge(edges, stand.sidewalk, stand.entry, "stand-access");
  addBidirectionalEdge(edges, stand.entry, stand.service, "stand-access");

  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    standEntryNodeId: stand.entry.id,
    standServiceNodeId: stand.service.id,
  });
};

export const createNeighborhoodNavigationGraph = (
  layout: ResidentialLayout,
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
