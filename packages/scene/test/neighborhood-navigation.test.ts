import { describe, expect, it } from "vitest";

import {
  createNeighborhoodNavigationGraph,
  navigationNode,
  shortestNavigationPath,
} from "../src/neighborhood-navigation.js";
import { generateResidentialLayout } from "../src/residential-layout.js";
import { STREET_LAYOUT } from "../src/street-layout.js";

describe("semantic neighborhood navigation", () => {
  it("is deterministic and follows the seeded residential plan", () => {
    const layout = generateResidentialLayout(0x12_34_ab_cd);
    const first = createNeighborhoodNavigationGraph(layout);
    const repeated = createNeighborhoodNavigationGraph(layout);

    expect(repeated).toEqual(first);
    expect(first.nodes.length).toBeGreaterThan(10);
    expect(first.edges.length).toBeGreaterThan(first.nodes.length);
  });

  it("keeps sidewalk nodes inside their semantic sidewalk bands", () => {
    const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(77));

    for (const node of graph.nodes) {
      if (node.role !== "sidewalk" || node.side === null) {
        continue;
      }
      const sidewalk =
        node.side === "near" ? STREET_LAYOUT.nearSidewalk : STREET_LAYOUT.farSidewalk;
      expect(node.z).toBeGreaterThanOrEqual(sidewalk.minZ);
      expect(node.z).toBeLessThanOrEqual(sidewalk.maxZ);
    }
  });

  it("routes far-side pedestrians through a real crossing before stand access", () => {
    const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(91));
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

    const pathEdges = path.slice(0, -1).map((nodeId, index) => {
      const next = path[index + 1];
      return graph.edges.find((edge) => edge.from === nodeId && edge.to === next);
    });
    expect(pathEdges.some((edge) => edge?.kind === "crossing")).toBe(true);
    expect(pathEdges.at(-1)?.kind).toBe("stand-access");
  });

  it("exposes stand entry and service as distinct interaction slots", () => {
    const graph = createNeighborhoodNavigationGraph(generateResidentialLayout(123));
    const entry = navigationNode(graph, graph.standEntryNodeId);
    const service = navigationNode(graph, graph.standServiceNodeId);

    expect(entry.role).toBe("stand-entry");
    expect(service.role).toBe("stand-service");
    expect(entry.z).toBeLessThan(STREET_LAYOUT.nearSidewalk.minZ);
    expect(service.z).toBeLessThan(entry.z);
  });
});
