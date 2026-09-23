import test from "node:test";
import assert from "node:assert/strict";

import { TOOL_DEFINITIONS, handleMcpRequest } from "./lemonade-mcp.mjs";

test("lists Lemonade scene and game tools", async () => {
  const reply = await handleMcpRequest(
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    { send: async () => ({}) },
  );

  assert.equal(reply?.result.tools.length, TOOL_DEFINITIONS.length);
  assert.ok(reply?.result.tools.some((tool) => tool.name === "lemonade_scene_tree"));
  assert.ok(reply?.result.tools.some((tool) => tool.name === "lemonade_game_state"));
});

test("maps MCP tool calls to the browser bridge", async () => {
  const calls = [];
  const reply = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "lemonade_scene_object",
        arguments: { id: "abc" },
      },
    },
    {
      send: async (method, params) => {
        calls.push({ method, params });
        return { id: "abc", name: "stand" };
      },
    },
  );

  assert.deepEqual(calls, [{ method: "scene.object", params: { id: "abc" } }]);
  assert.equal(reply?.result.isError, undefined);
  assert.deepEqual(reply?.result.structuredContent, { id: "abc", name: "stand" });
});

test("supports current MCP discovery with result discrimination", async () => {
  const reply = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: "discover",
      method: "server/discover",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        },
      },
    },
    { send: async () => ({}) },
  );

  assert.equal(reply?.result.resultType, "complete");
  assert.deepEqual(reply?.result.supportedVersions, ["2026-07-28"]);
  assert.ok(reply?.result.capabilities.tools);
});

test("advertises legacy initialization for broad MCP host compatibility", async () => {
  const reply = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "initialize",
      params: { protocolVersion: "2025-11-25" },
    },
    { send: async () => ({}) },
  );

  assert.equal(reply?.result.protocolVersion, "2025-11-25");
  assert.equal(reply?.result.serverInfo.name, "lemonade-scene-game");
});
