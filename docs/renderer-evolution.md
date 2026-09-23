# Scene renderer migration

Tracked by #162 and #163.

## Decision

Babylon.js is the target production scene engine for Lemonsville.

Three.js remains temporarily as the compatibility/reference renderer while Babylon reaches behavioral, visual, accessibility and performance parity. New renderer-specific work should target Babylon unless it is required to keep the reference renderer stable enough for migration certification.

The simulation, occurrence ledger, storyboard, navigation, reporting, accessibility and persistence layers remain renderer-neutral.

## Foundation

The migration starts with a separately lazy-loaded Babylon runtime using `@babylonjs/core`. The critical application entry must never eagerly load either 3D engine.

During migration:

- default production rendering remains Three until the Babylon parity gates are green;
- `LEMONADE_SCENE_BACKEND=babylon` selects the Babylon runtime for development and browser certification;
- Babylon and Three consume the same `LemonsvilleSceneState` and storyboard contracts;
- the static/text fallback remains available if the selected engine cannot initialize.

## Port order

1. renderer shell, camera, lighting and diagnostics;
2. ground, streets, sidewalks, driveways and paths;
3. houses, fences, vegetation and static props;
4. stand, signs, cups and stock projection;
5. seller, pedestrians, buyers and character animation;
6. vehicles, bicycles, pets and residential occurrences;
7. weather, day/night, clouds, wind and storm effects;
8. Babylon picking, gizmos, Inspector and local diagnostic/MCP tooling;
9. certification, default cutover and Three.js removal.

## Rendering strategy

Prefer Babylon-native facilities rather than recreating Three-specific abstractions:

- instances/thin instances for repeated static geometry;
- Babylon animation groups/skeletons when character assets justify them;
- engine/scene instrumentation for performance evidence;
- Babylon picking/gizmos/Inspector for developer tooling;
- WebGPU only after the Babylon scene is behaviorally stable enough to compare with its WebGL path.

## Certification fixture

Use the same deterministic high-load fixture throughout migration:

- full procedural neighborhood;
- approximately 60 simultaneously active pedestrians;
- 400-sale stress storyboard;
- representative cars, bicycles, pets and residential activity;
- wind-responsive vegetation;
- all weather modes and the business-day lighting cycle;
- portrait and landscape cameras;
- diagnostics/picking enabled in a separate developer run.

Capture startup cost, bundle contribution, p50/p95 CPU frame time, GPU frame time when available, draw calls, primitives, live resources and browser evidence.

## Cutover gate

Babylon becomes the default only when:

- current release/browser/mobile contracts pass on Babylon;
- authoritative storyboard/occurrence events remain complete;
- no pedestrian speed/teleport regressions are introduced;
- scene semantics remain available in text/accessibility equivalents;
- the critical application entry remains within its lazy-loading budget;
- the stress fixture provides comparable or improved performance evidence.

After cutover, remove Three.js, `@types/three`, Three-only renderer utilities and superseded Three-only developer tooling.
