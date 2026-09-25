import { expect, it } from "vitest";

import {
  createNeighborhoodNavigationGraph,
  createNeighborhoodNavigationGraphFromTopology,
  navigationNode,
  shortestNavigationPath,
} from "../src/neighborhood-navigation.js";
import { generateNeighborhoodTopology } from "../src/neighborhood-topology.js";
import { generateResidentialLayout } from "../src/residential-layout.js";

const NAVIGATION_SEED = 0x12_34_ab_cd;
const ROUTE_SEED = 91;
const STAND_SEED = 123;

it("derives navigation deterministically from the generated topology", () => {
  const layout = generateResidentialLayout(NAVIGATION_SEED);
  const topology = generateNeighborhoodTopology(NAVIGATION_SEED);
  const fromLayout = createNeighborhoodNavigationGraph(layout);
  const fromTopology = createNeighborhoodNavigationGraphFromTopology(topology);

  expect(fromLayout).toEqual(fromTopology);
  expect(fromLayout.nodes.length).toBeGreaterThan(topology.sidewalks.length);
  expect(fromLayout.edges.length).toBeGreaterThan(topology.sidewalks.length);
});

it("represents every generated sidewalk segment and non-main street", () => {
  const topology = generateNeighborhoodTopology(NAVIGATION_SEED);
  const graph = createNeighborhoodNavigationGraphFromTopology(topology);
  const representedSegments = new Set(
    graph.nodes
      .map((node) => node.segmentId)
      .filter((segmentId): segmentId is string => segmentId !== null),
  );
  const representedStreets = new Set(
    graph.nodes
      .map((node) => node.streetId)
      .filter((streetId): streetId is string => streetId !== null),
  );

  expect(representedSegments).toEqual(new Set(topology.sidewalks.map((segment) => segment.id)));
  expect(representedStreets).toEqual(
    new Set(topology.sidewalks.map((segment) => segment.streetId)),
  );
  expect([...representedStreets].some((streetId) => streetId !== "main")).toBe(true);
});

it("preserves near and far semantic sides only for main-street sidewalk nodes", () => {
  const graph = createNeighborhoodNavigationGraph(
    generateResidentialLayout(NAVIGATION_SEED),
  );
  const mainNodes = graph.nodes.filter(
    (node) => node.role === "sidewalk" && node.streetId === "main",
  );
  const secondaryNodes = graph.nodes.filter(
    (node) => node.role === "sidewalk" && node.streetId !== "main",
  );

  expect(mainNodes.some((node) => node.side === "near")).toBe(true);
  expect(mainNodes.some((node) => node.side === "far")).toBe(true);
  expect(secondaryNodes.every((node) => node.side === null)).toBe(true);
});

it("routes far-side pedestrians through generated crossing edges before stand service", () => {
  const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(ROUTE_SEED));
  const farNodes = graph.nodes
    .filter((node) => node.role === "sidewalk" && node.side === "far")
    .sort((left, right) => left.x - right.x);
  const start = farNodes[0];
  if (start === undefined) {
    throw new Error("expected far sidewalk node");
  }

  const path = shortestNavigationPath(graph, start.id, graph.standServiceNodeId);
  expect(path.length).toBeGreaterThan(3);
  expect(path.at(-1)).toBe(graph.standServiceNodeId);

  const pathKinds = path.slice(0, -1).map((nodeId, index) => {
    const next = path[index + 1];
    return graph.edges.find((edge) => edge.from === nodeId && edge.to === next)?.kind;
  });
  expect(pathKinds).toContain("crossing");
  expect(pathKinds.at(-1)).toBe("stand-access");
});

it("keeps stand entry and service as distinct interaction slots", () => {
  const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(STAND_SEED));
  const entry = navigationNode(graph, graph.standEntryNodeId);
  const service = navigationNode(graph, graph.standServiceNodeId);

  expect(entry.role).toBe("stand-entry");
  expect(service.role).toBe("stand-service");
  expect(entry.side).toBe("near");
  expect(service.side).toBe("near");
  expect(service.z).toBeLessThan(entry.z);
});
