# Lemonade scene/game MCP

Lemonade includes a local Model Context Protocol (MCP) server for inspecting the
authoritative game run and the exact Three.js scene currently rendered in the
browser. The same bridge also connects MCP edits to the existing scene launcher
and gizmo instead of maintaining a second editor state.

## Architecture

```text
MCP host
  │ stdio JSON-RPC
  ▼
scripts/lemonade-mcp.mjs
  │ loopback HTTP command relay (127.0.0.1:5178)
  ▼
apps/web/src/dev-mcp-bridge.ts
  │
  ├─ LemonadeApp authoritative run + validated draft controls
  └─ LemonsvilleSceneView
       └─ SceneDevtoolsController
            ├─ THREE.Scene / Camera
            ├─ WebGLRenderer.info
            └─ existing GizmoController / TransformControls
```

The relay is development-only, binds to loopback, and accepts the Lemonade
GitHub Pages origin plus local HTTP/HTTPS origins. Completed ledger/history state
is read-only. Game editing is deliberately limited to current planning inputs;
scene-only presentation overrides do not rewrite the persisted economic
environment or completed history.

## Start it

From the repository root:

```bash
pnpm mcp:scene
```

Then run/open the web app and enable the browser bridge once:

```js
enableMcpBridge()
enableGizmo() // optional, required for scene selection/mode tools
location.reload()
```

The browser flag is stored in `LEMONADE_DEV_MCP`. The default relay is
`http://127.0.0.1:5178`. For a different loopback port:

```bash
LEMONADE_MCP_PORT=5188 pnpm mcp:scene
```

```js
setMcpBridgeUrl("http://127.0.0.1:5188")
location.reload()
```

An MCP host should launch the repository command as a stdio server. A generic
configuration is:

```json
{
  "mcpServers": {
    "lemonade": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/Lemonade", "mcp:scene"]
    }
  }
}
```

Host configuration keys vary; keep the process working directory/repository path
explicit so pnpm resolves the correct workspace.

## Tool surface

| Tool | Purpose |
| --- | --- |
| `lemonade_runtime_snapshot` | Combined game + active Three.js diagnostics |
| `lemonade_game_state` | Run, environment, draft, presentation, scene overrides |
| `lemonade_game_set_draft` | Edit glasses/signs/price through current game limits |
| `lemonade_scene_diagnostics` | Object counts, camera, `renderer.info`, gizmo state |
| `lemonade_scene_tree` | Bounded compact live scene hierarchy |
| `lemonade_scene_object` | Transform/material details by UUID or name |
| `lemonade_scene_set_transform` | Position/rotation/scale edit + immediate render |
| `lemonade_scene_set_visibility` | Toggle object visibility |
| `lemonade_scene_select` | Select/clear through the existing gizmo |
| `lemonade_scene_set_transform_mode` | Translate/rotate/scale gizmo mode |
| `lemonade_scene_set_presentation` | Weather/phase/crowd presentation override |

Use `lemonade_scene_tree` first, then use the returned UUID as the selector for
object-specific tools. Names are accepted as a convenience but UUIDs avoid
ambiguity.

## Diagnostics contract

Scene diagnostics are sampled on demand, so the MCP does not add a second frame
loop. The snapshot includes:

- current `LemonsvilleSceneState`;
- object, visible-object, mesh, and named-object counts;
- camera transform and perspective parameters;
- `WebGLRenderer.info.memory` geometries/textures;
- `WebGLRenderer.info.render` calls/triangles/points/lines/frame;
- compiled program count;
- whether the gizmo is active, its transform mode, and current selection.

This keeps automated diagnostics aligned with what the visual editor displays.

## Editing contract

Object transform and visibility changes mutate the live Three.js object and
force a render. Gizmo selection/mode calls use the existing
`GizmoController`, which itself builds on Three.js `TransformControls`.

Game-state mutation is intentionally narrower. `lemonade_game_set_draft`
only edits current planning controls and clamps them using the same operating
limits as the UI. It cannot rewrite cash, debt, day number, ledger entries, or a
completed result. `lemonade_scene_set_presentation` is presentation-only and
keeps weather/phase/crowd experiments separate from persisted game history.

## MCP wire compatibility

The server has no runtime package dependency and therefore does not modify the
frozen pnpm lockfile. The small stdio adapter supports both protocol eras:

- MCP 2026-07-28 through `server/discover`, per-request protocol metadata, and
  required `resultType` discrimination;
- MCP 2025-11-25 through the legacy `initialize` handshake.

This matches the current MCP TypeScript SDK's dual-era serving model while
keeping the browser relay and scene/game tool contract independent of the MCP
library. A future move to `@modelcontextprotocol/server` can therefore replace
only the wire adapter.

## Three.js references

The design follows established Three.js debugging patterns rather than inventing
a separate scene representation:

- Three.js TransformControls:
  https://threejs.org/docs/pages/TransformControls.html
- Three.js WebGLRenderer `info` diagnostics:
  https://threejs.org/docs/pages/WebGLRenderer.html
- Archived official Three.js DevTools, including observing a live
  `Scene`/`Renderer` from the page:
  https://github.com/threejs/three-devtools
- Three.js DevTools MCP, a contemporary reference for scene-tree/object/material
  inspection over a browser bridge:
  https://github.com/DmitriyGolub/threejs-devtools-mcp

The archived devtools are reference material only; Lemonade does not depend on
them.
