import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.LEMONADE_MCP_PORT ?? "5178", 10);
const LEGACY_PROTOCOL_VERSION = "2025-11-25";
const MODERN_PROTOCOL_VERSION = "2026-07-28";
const SERVER_INFO = Object.freeze({
  name: "lemonade-scene-game",
  version: "0.1.0",
});
const SERVER_INSTRUCTIONS =
  "Open the Lemonade web app with enableMcpBridge(). Enable enableGizmo() for visual selection and transform-mode tools.";
const BRIDGE_TIMEOUT_MS = 15_000;
const POLL_TIMEOUT_MS = 20_000;

const objectSchema = (properties = {}, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const number = { type: "number" };
const integer = { type: "integer", minimum: 0 };
const vec3 = {
  type: "array",
  items: { type: "number" },
  minItems: 3,
  maxItems: 3,
};

export const TOOL_DEFINITIONS = Object.freeze([
  {
    name: "lemonade_runtime_snapshot",
    description:
      "Inspect the authoritative Lemonade run plus the active Three.js scene, camera, renderer metrics, and editor selection.",
    inputSchema: objectSchema(),
    bridgeMethod: "runtime.snapshot",
  },
  {
    name: "lemonade_game_state",
    description:
      "Inspect the current game run state, environment, draft decisions, presentation phase, and developer scene overrides.",
    inputSchema: objectSchema(),
    bridgeMethod: "game.state",
  },
  {
    name: "lemonade_game_set_draft",
    description:
      "Edit the current planning draft through the same validated limits used by the game UI. Completed game history is never mutated.",
    inputSchema: objectSchema({
      glasses: integer,
      signs: integer,
      priceCents: integer,
    }),
    bridgeMethod: "game.set_draft",
  },
  {
    name: "lemonade_scene_diagnostics",
    description:
      "Inspect scene object counts, camera state, WebGLRenderer memory/render counters, current scene state, and gizmo state.",
    inputSchema: objectSchema(),
    bridgeMethod: "scene.diagnostics",
  },
  {
    name: "lemonade_scene_tree",
    description:
      "Return a bounded compact tree of the live Three.js scene. Object UUIDs are stable selectors for follow-up tools.",
    inputSchema: objectSchema({
      maxDepth: { type: "integer", minimum: 0, maximum: 8 },
      maxChildren: { type: "integer", minimum: 1, maximum: 250 },
    }),
    bridgeMethod: "scene.tree",
  },
  {
    name: "lemonade_scene_object",
    description:
      "Inspect one live Three.js object by UUID or object name, including transform, world position, visibility, and materials.",
    inputSchema: objectSchema({ id: { type: "string", minLength: 1 } }, ["id"]),
    bridgeMethod: "scene.object",
  },
  {
    name: "lemonade_scene_set_transform",
    description:
      "Set position, rotation, or scale on one live Three.js object and render the change immediately.",
    inputSchema: objectSchema(
      {
        id: { type: "string", minLength: 1 },
        position: vec3,
        rotation: vec3,
        scale: vec3,
      },
      ["id"],
    ),
    bridgeMethod: "scene.set_transform",
  },
  {
    name: "lemonade_scene_set_visibility",
    description: "Show or hide one live Three.js object and render the change immediately.",
    inputSchema: objectSchema(
      {
        id: { type: "string", minLength: 1 },
        visible: { type: "boolean" },
      },
      ["id", "visible"],
    ),
    bridgeMethod: "scene.set_visibility",
  },
  {
    name: "lemonade_scene_select",
    description:
      "Select a scene object in the existing Lemonade gizmo, or clear selection with null. Requires the gizmo developer flag.",
    inputSchema: objectSchema({
      id: {
        anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
      },
    }),
    bridgeMethod: "scene.select",
  },
  {
    name: "lemonade_scene_set_transform_mode",
    description:
      "Switch the existing Three.js gizmo between translate, rotate, and scale modes.",
    inputSchema: objectSchema(
      {
        mode: { type: "string", enum: ["translate", "rotate", "scale"] },
      },
      ["mode"],
    ),
    bridgeMethod: "scene.set_mode",
  },
  {
    name: "lemonade_scene_set_presentation",
    description:
      "Apply a developer-only weather/phase presentation override without rewriting completed economic history.",
    inputSchema: objectSchema(
      {
        weather: {
          type: "string",
          enum: ["sunny", "cloudy", "hot-and-dry", "thunderstorm"],
        },
        phase: { type: "string", enum: ["forecast", "idle", "simulation"] },
        confidence: { ...number, minimum: 0, maximum: 5 },
        prepared: integer,
        sold: integer,
        visibleSigns: integer,
      },
      ["weather", "phase"],
    ),
    bridgeMethod: "scene.set_presentation",
  },
]);

const publicTool = ({ bridgeMethod: _bridgeMethod, ...tool }) => tool;
const toolByName = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

const serverMeta = () => ({
  "io.modelcontextprotocol/serverInfo": SERVER_INFO,
});

const completeResult = (result, modern) =>
  modern
    ? {
        resultType: "complete",
        ...result,
        _meta: {
          ...(result._meta ?? {}),
          ...serverMeta(),
        },
      }
    : result;

const textResult = (value, modern) =>
  completeResult(
    {
      content: [
        {
          type: "text",
          text: JSON.stringify(value, null, 2),
        },
      ],
      structuredContent: value,
    },
    modern,
  );

const toolError = (error, modern) =>
  completeResult(
    {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    },
    modern,
  );

const modernRequest = (message) =>
  message?.method === "server/discover" ||
  message?.params?._meta?.["io.modelcontextprotocol/protocolVersion"] ===
    MODERN_PROTOCOL_VERSION;

export const handleMcpRequest = async (message, bridge) => {
  const method = message?.method;
  const id = message?.id;

  if (typeof method !== "string") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32600, message: "Invalid Request" },
    };
  }

  if (method.startsWith("notifications/")) return null;

  const modern = modernRequest(message);

  if (method === "server/discover") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        resultType: "complete",
        supportedVersions: [MODERN_PROTOCOL_VERSION],
        capabilities: { tools: {} },
        instructions: SERVER_INSTRUCTIONS,
        cacheScope: "private",
        ttlMs: 0,
        _meta: serverMeta(),
      },
    };
  }

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        protocolVersion: LEGACY_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      },
    };
  }

  if (method === "ping") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      result: completeResult({}, modern),
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      result: completeResult({ tools: TOOL_DEFINITIONS.map(publicTool) }, modern),
    };
  }

  if (method === "tools/call") {
    const name = message?.params?.name;
    const args = message?.params?.arguments ?? {};
    if (typeof name !== "string" || !toolByName.has(name)) {
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: toolError(
          new RangeError(`Unknown Lemonade MCP tool: ${String(name)}`),
          modern,
        ),
      };
    }

    const tool = toolByName.get(name);
    try {
      const result = await bridge.send(tool.bridgeMethod, args);
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: textResult(result, modern),
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        result: toolError(error, modern),
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
};

const readJsonBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_048_576) throw new RangeError("Bridge request body is too large.");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length === 0 ? {} : JSON.parse(text);
};

const allowedOrigin = (origin) => {
  if (origin === undefined) return true;
  if (origin === "https://xtreemze.github.io") return true;
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
};

export const createBridgeHub = () => {
  let sessionId = null;
  let pollResponse = null;
  let pollTimer = null;
  const queue = [];
  const pending = new Map();

  const clearPoll = () => {
    if (pollTimer !== null) clearTimeout(pollTimer);
    pollTimer = null;
    pollResponse = null;
  };

  const rejectPending = (message) => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error(message));
    }
    pending.clear();
    queue.length = 0;
  };

  const writeCommand = (response, command) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(command));
  };

  const flush = () => {
    if (pollResponse === null || queue.length === 0) return;
    const response = pollResponse;
    const command = queue.shift();
    clearPoll();
    writeCommand(response, command);
  };

  return Object.freeze({
    register() {
      rejectPending("Browser bridge reconnected before the previous command completed.");
      if (pollResponse !== null) {
        pollResponse.writeHead(410);
        pollResponse.end();
        clearPoll();
      }
      sessionId = randomUUID();
      return sessionId;
    },
    poll(candidateSessionId, response) {
      if (candidateSessionId !== sessionId || sessionId === null) {
        response.writeHead(410);
        response.end();
        return;
      }
      if (pollResponse !== null) {
        pollResponse.writeHead(409);
        pollResponse.end();
        clearPoll();
      }
      pollResponse = response;
      pollTimer = setTimeout(() => {
        if (pollResponse === response) {
          response.writeHead(204);
          response.end();
          clearPoll();
        }
      }, POLL_TIMEOUT_MS);
      flush();
    },
    resolve(payload) {
      if (payload.sessionId !== sessionId || typeof payload.id !== "string") {
        return false;
      }
      const waiter = pending.get(payload.id);
      if (waiter === undefined) return false;
      pending.delete(payload.id);
      clearTimeout(waiter.timer);
      if (typeof payload.error === "string" && payload.error.length > 0) {
        waiter.reject(new Error(payload.error));
      } else {
        waiter.resolve(payload.result);
      }
      return true;
    },
    send(method, params) {
      if (sessionId === null) {
        return Promise.reject(
          new Error(
            "No Lemonade browser is connected. Run the web app, call enableMcpBridge(), and refresh.",
          ),
        );
      }
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Browser bridge timed out while running ${method}.`));
        }, BRIDGE_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer });
        queue.push({ id, method, params });
        flush();
      });
    },
    close() {
      rejectPending("MCP server stopped.");
      if (pollResponse !== null) {
        pollResponse.writeHead(410);
        pollResponse.end();
      }
      clearPoll();
      sessionId = null;
    },
  });
};

const sendHttpJson = (response, status, payload, origin) => {
  if (origin !== undefined) response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

export const createBridgeServer = (bridge) =>
  createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (!allowedOrigin(origin)) {
      sendHttpJson(response, 403, { error: "Origin is not allowed." });
      return;
    }
    if (origin !== undefined) response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${HOST}:${String(PORT)}`);
    try {
      if (request.method === "POST" && url.pathname === "/bridge/register") {
        await readJsonBody(request);
        sendHttpJson(response, 200, { sessionId: bridge.register() }, origin);
        return;
      }

      if (request.method === "GET" && url.pathname === "/bridge/command") {
        bridge.poll(url.searchParams.get("sessionId"), response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/bridge/result") {
        const payload = await readJsonBody(request);
        const accepted = bridge.resolve(payload);
        sendHttpJson(response, accepted ? 200 : 409, { accepted }, origin);
        return;
      }

      sendHttpJson(response, 404, { error: "Not found." }, origin);
    } catch (error) {
      sendHttpJson(
        response,
        400,
        { error: error instanceof Error ? error.message : String(error) },
        origin,
      );
    }
  });

export const startMcpServer = () => {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
    throw new RangeError("LEMONADE_MCP_PORT must be a valid TCP port.");
  }

  const bridge = createBridgeHub();
  const server = createBridgeServer(bridge);
  server.listen(PORT, HOST, () => {
    process.stderr.write(
      `Lemonade MCP bridge listening on http://${HOST}:${String(PORT)}\n`,
    );
  });

  const input = createInterface({ input: process.stdin, terminal: false });
  input.on("line", (line) => {
    if (line.trim().length === 0) return;
    void Promise.resolve()
      .then(() => JSON.parse(line))
      .then((message) => handleMcpRequest(message, bridge))
      .then((reply) => {
        if (reply !== null) process.stdout.write(`${JSON.stringify(reply)}\n`);
      })
      .catch((error) => {
        process.stdout.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: error instanceof Error ? error.message : String(error),
            },
          })}\n`,
        );
      });
  });

  input.on("close", () => {
    bridge.close();
    server.close();
  });

  return { bridge, server };
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  startMcpServer();
}
