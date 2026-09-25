import { describe, expect, it } from "vitest";

import {
  createNeighborhoodNavigationGraph,
  createNeighborhoodNavigationGraphFromTopology,
  navigationNode,
  shortestNavigationPath,
} from "../src/neighborhood-navigation.js";
import { generateNeighborhoodTopology } from "../src/neighborhood-topology.js";
import { generateResidentialLayout } from "../src/residential-layout.js";

describe("semantic neighborhood navigation", () => {
  it("is deterministic and projects the generated topology rather than static foreground rows", () => {
    const seed = 0x12_34_ab_cd;
    const layout = generateResidentialLayout(seed);
    const topology = generateNeighborhoodTopology(seed);
    const first = createNeighborhoodNavigationGraph(layout);
    const repeated = createNeighborhoodNavigationGraph(layout);

    expect(repeated).toEqual(first);
    expect(first.nodes.filter((node) => node.role === "sidewalk")).toHaveLength(
      topology.sidewalks.length,
    );
    expect(first.edges.length).toBeGreaterThan(first.nodes.length);
    expect(new Set(first.nodes.map((node) => node.streetId).filter(Boolean))).toEqual(
      new Set(topology.sidewalks.map((sidewalk) => sidewalk.streetId)),
    );
  });

  it("preserves every generated sidewalk segment as a semantic navigation node", () => {
    const topology = generateNeighborhoodTopology(77);
    const graph = createNeighborhoodNavigationGraphFromTopology(topology);
    const sidewalkIds = new Set(
      graph.nodes
        .filter((node) => node.role === "sidewalk")
        .map((node) => node.sidewalkSegmentId),
    );

    for (const sidewalk of topology.sidewalks) {
      expect(sidewalkIds.has(sidewalk.id)).toBe(true);
    }
  });

  it("connects generated street systems through topology junction crossings", () => {
    const topology = generateNeighborhoodTopology(91);
    const graph = createNeighborhoodNavigationGraphFromTopology(topology);
    const crossingEdges = graph.edges.filter((edge) => edge.kind === "crossing");

    expect(topology.junctions.length).toBeGreaterThan(0);
    expect(crossingEdges.length).toBeGreaterThan(0);
    expect(
      crossingEdges.some((edge) => {
        const from = navigationNode(graph, edge.from);
        const to = navigationNode(graph, edge.to);
        return from.streetId !== undefined && to.streetId !== undefined && from.streetId !== to.streetId;
      }),
    ).toBe(true);
  });

  it("routes a far-side main-street pedestrian through a junction before stand access", () => {
    const topology = generateNeighborhoodTopology(91);
    const graph = createNeighborhoodNavigationGraphFromTopology(topology);
    const start = graph.nodes
      .filter(
        (node) => node.role === "sidewalk" && node.streetId === "main" && node.side === "far",
      )
      .sort((left, right) => left.x - right.x)[0];
    if (start === undefined) {
      throw new Error("expected far main-street sidewalk node");
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

  it("derives stand entry and service positions from the generated main sidewalk", () => {
    const topology = generateNeighborhoodTopology(123);
    const graph = createNeighborhoodNavigationGraphFromTopology(topology);
    const entry = navigationNode(graph, graph.standEntryNodeId);
    const service = navigationNode(graph, graph.standServiceNodeId);
    const linkedSidewalkEdge = graph.edges.find(
      (edge) => edge.to === entry.id && edge.kind === "stand-access",
    );
    expect(linkedSidewalkEdge).toBeDefined();
    if (linkedSidewalkEdge === undefined) {
      return;
    }
    const sidewalk = navigationNode(graph, linkedSidewalkEdge.from);

    expect(entry.role).toBe("stand-entry");
    expect(service.role).toBe("stand-service");
    expect(sidewalk.streetId).toBe("main");
    expect(sidewalk.side).toBe("near");
    expect(Math.hypot(entry.x - sidewalk.x, entry.z - sidewalk.z)).toBeGreaterThan(0);
    expect(Math.hypot(service.x - sidewalk.x, service.z - sidewalk.z)).toBeGreaterThan(
      Math.hypot(entry.x - sidewalk.x, entry.z - sidewalk.z),
    );
  });
});
