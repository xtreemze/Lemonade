# Scene renderer evolution

Tracked by #162 and #163.

## Decision

Three.js remains the production scene foundation while Lemonsville is optimized and measured. The renderer is an adapter around deterministic simulation, occurrence, storyboard, accessibility and world-layout contracts; those contracts must not depend on Three.js so a later engine change remains possible.

Babylon.js is the preferred complete-engine migration candidate if Lemonade materially outgrows the current procedural/code-first scene architecture. It is not a dependency yet.

luma.gl and deck.gl are not primary scene-engine candidates. Their GPU/data-visualization strengths do not replace the complete animated scene, asset, material, character, weather and tooling responsibilities Lemonade needs.

## Near-term sequence

1. Establish renderer diagnostics and explicit performance budgets.
2. Bound expensive visual actor rigs independently from logical customer/storyboard identity.
3. Share resources and use Three.js instancing/batching for repeated/static scene geometry.
4. Replace recurring whole-scene traversal with explicit registries/spatial indexes where profiling shows cost.
5. Certify the intended busy scene on mobile and desktop.
6. Prototype Three.js WebGPU/TSL behind an experimental backend once the production scene has a renderer boundary.
7. Benchmark Babylon.js against the same deterministic fixture only after the optimized Three.js baseline exists.

## Renderer-neutral boundary

The engine may own:

- scene graph and render resources;
- camera projection/interpolation;
- geometry/material/asset realization;
- animation interpolation;
- picking and developer visualization;
- renderer-specific LOD, batching and instancing.

The engine must not own:

- economic/customer outcomes;
- occurrence scheduling;
- customer identity;
- route intent or right-of-way decisions;
- persisted simulation state;
- accessibility/report semantics.

A renderer migration should therefore replace the projection of the same world/storyboard facts, not rewrite game rules.

## Certification fixture

Use one deterministic high-load fixture for renderer comparisons:

- full procedural neighborhood;
- approximately 60 simultaneously active pedestrians;
- representative cars, bicycles, pets and residential activity;
- wind-responsive vegetation;
- sunny/cloudy/hot-and-dry/thunderstorm presentation;
- business-day lighting cycle;
- portrait and landscape cinematic cameras;
- picking/dev-tool interaction enabled in a separate diagnostic run.

Capture at minimum:

- startup and scene-initialization cost;
- p50/p95 CPU frame time;
- GPU frame time when available;
- draw calls;
- triangles/points/lines;
- live geometries/textures;
- active visual rigs versus logical actors;
- memory/GC evidence;
- production bundle contribution.

## Babylon.js migration gate

Evaluate a real Babylon.js slice when one or more of these conditions becomes material:

- imported/skeletal character animation and blending at scale;
- engine-owned navigation or physics is needed;
- sophisticated particles/VFX become a core scene requirement;
- asset streaming and editor-oriented authoring outweigh code-first procedural generation;
- maintaining custom Three.js tooling costs more than adopting an engine;
- optimized Three.js misses certified mobile frame/memory budgets.

Migration requires an equivalent implementation of the certification fixture. Do not compare an optimized Babylon.js scene to the current eager-object Three.js implementation.

The migration decision should consider performance, bundle/startup cost, authoring/tooling complexity, portability of deterministic contracts, accessibility integration and long-term maintenance—not feature count alone.
