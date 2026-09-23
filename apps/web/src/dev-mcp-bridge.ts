const MCP_FLAG = "LEMONADE_DEV_MCP";
const MCP_URL_KEY = "LEMONADE_DEV_MCP_URL";
const DEFAULT_MCP_URL = "http://127.0.0.1:5178";

export type DevMcpCommand = Readonly<{
  id: string;
  method: string;
  params: unknown;
}>;

export type DevMcpCommandHandler = (
  method: string,
  params: unknown,
) => unknown | Promise<unknown>;

export type DevMcpBrowserBridge = Readonly<{
  dispose(): void;
}>;

export const isMcpBridgeEnabled = (): boolean =>
  typeof localStorage !== "undefined" && localStorage.getItem(MCP_FLAG) === "1";

export const enableMcpBridge = (): void => {
  localStorage.setItem(MCP_FLAG, "1");
  console.log("Lemonade MCP bridge enabled. Refresh the page after starting pnpm mcp:scene.");
};

export const disableMcpBridge = (): void => {
  localStorage.removeItem(MCP_FLAG);
  console.log("Lemonade MCP bridge disabled. Refresh the page.");
};

export const setMcpBridgeUrl = (url: string): void => {
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new TypeError("The Lemonade MCP bridge must use a loopback host.");
  }
  localStorage.setItem(MCP_URL_KEY, parsed.origin);
};

export const printMcpBridgeHelp = (): void => {
  console.log(`Lemonade scene/game MCP

1. Run: pnpm mcp:scene
2. In this page: enableMcpBridge()
3. Also enable the visual editor when needed: enableGizmo()
4. Refresh the page.

The bridge is loopback-only. MCP tools inspect the authoritative run state and live
Three.js renderer. Editing is limited to draft decisions, scene presentation,
object transforms/visibility, and the existing gizmo selection/mode controls.`);
};

const bridgeBaseUrl = (): string => {
  const configured = localStorage.getItem(MCP_URL_KEY);
  if (configured === null) return DEFAULT_MCP_URL;
  try {
    const url = new URL(configured);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return url.origin;
  } catch {
    // Fall through to the safe loopback default.
  }
  return DEFAULT_MCP_URL;
};

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, delayMs));

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const createDevMcpBrowserBridge = (
  handler: DevMcpCommandHandler,
): DevMcpBrowserBridge => {
  const baseUrl = bridgeBaseUrl();
  const abortController = new AbortController();
  let disposed = false;
  let sessionId: string | null = null;

  const request = async (
    path: string,
    init: RequestInit = {},
  ): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    return fetch(`${baseUrl}${path}`, {
      ...init,
      signal: abortController.signal,
      headers,
    });
  };

  const register = async (): Promise<string> => {
    const response = await request("/bridge/register", {
      method: "POST",
      body: JSON.stringify({
        client: "lemonade-web",
        protocol: 1,
        href: location.href,
      }),
    });
    if (!response.ok) {
      throw new Error(`MCP bridge registration failed: HTTP ${String(response.status)}`);
    }
    const payload = (await response.json()) as Readonly<{ sessionId?: unknown }>;
    if (typeof payload.sessionId !== "string") {
      throw new TypeError("MCP bridge registration did not return a session id.");
    }
    return payload.sessionId;
  };

  const deliver = async (
    command: DevMcpCommand,
    result: unknown,
    error: string | null,
  ): Promise<void> => {
    if (sessionId === null) return;
    const response = await request("/bridge/result", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        id: command.id,
        result,
        error,
      }),
    });
    if (!response.ok) {
      throw new Error(`MCP bridge result failed: HTTP ${String(response.status)}`);
    }
  };

  const poll = async (): Promise<void> => {
    while (!disposed) {
      try {
        sessionId ??= await register();
        const response = await request(
          `/bridge/command?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (response.status === 204) continue;
        if (response.status === 410) {
          sessionId = null;
          continue;
        }
        if (!response.ok) {
          throw new Error(`MCP bridge poll failed: HTTP ${String(response.status)}`);
        }

        const command = (await response.json()) as DevMcpCommand;
        try {
          const result = await handler(command.method, command.params);
          await deliver(command, result, null);
        } catch (error) {
          await deliver(command, null, errorMessage(error));
        }
      } catch (error) {
        if (disposed || abortController.signal.aborted) return;
        console.warn("Lemonade MCP bridge disconnected:", errorMessage(error));
        sessionId = null;
        await sleep(750);
      }
    }
  };

  void poll();

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      abortController.abort();
    },
  });
};

if (typeof window !== "undefined") {
  Object.assign(window, {
    enableMcpBridge,
    disableMcpBridge,
    setMcpBridgeUrl,
    mcpBridgeHelp: printMcpBridgeHelp,
  });
}
