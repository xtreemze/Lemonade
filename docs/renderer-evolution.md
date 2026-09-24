# Scene renderer evolution

Tracked by #162 and #163, with migration slices #196–#200.

## Decision

Babylon.js is the production target for Lemonsville under #163. Three.js remains temporary production/reference infrastructure only while Babylon reaches semantic, visual, interaction, accessibility, mobile, and performance parity.

The renderer is an adapter around deterministic simulation, occurrence, storyboard, accessibility, navigation, feedback, and world-layout contracts. Those contracts must remain engine-neutral. This is an engine migration, not a rewrite of game rules or neighborhood semantics.

luma.gl and deck.gl are not primary scene-engine candidates. Their GPU/data-visualization strengths do not replace the complete animated scene, asset, material, character, weather, interaction, and tooling responsibilities Lemonade needs.

## Migration sequence

1. Keep renderer-neutral contracts authoritative.
2. Establish shared diagnostics, deterministic stress fixtures, and explicit performance budgets (#162).
3. Port procedural neighborhood and static world projection to Babylon (#196).
4. Port stand, inventory, signs, seller, and customer actors (#197).
5. Port neighborhood mobility, ambient life, weather, lighting, and vegetation (#198).
6. Replace Three-specific editor/gizmos and diagnostics with Babylon-native tooling while retaining engine-neutral dev-tool operations (#199).
7. Run complete parity, browser, accessibility, mobile, bundle/startup, and performance certification.
8. Make Babylon the sole production renderer and remove Three.js runtime/types and Three-only tooling (#200).

Do not add new Three-only architecture unless required to keep the reference renderer stable enough for migration certification.

## Renderer-neutral boundary

The engine may own:

- scene graph and render resources;
- camera projection/interpolation;
- geometry/material/asset realization;
- animation interpolation;
- picking and developer visualization;
- renderer-specific LOD, batching, instancing, and resource diagnostics.

The engine must not own:

- economic/customer outcomes;
- occurrence scheduling;
- customer identity;
- route intent or right-of-way decisions;
- persisted simulation state;
- accessibility/report semantics;
- authoritative environment or feedback event timing.

A renderer migration therefore replaces the projection of the same world/storyboard facts rather than changing those facts.

## Certification fixture

Use one deterministic high-load fixture across Three reference and Babylon target implementations:

- full procedural neighborhood;
- approximately 60 simultaneously active pedestrians;
- representative cars, bicycles, pets, wildlife, and residential activity;
- authoritative customer/storyboard activity including the high-sale envelope;
- wind-responsive vegetation;
- sunny/cloudy/hot-and-dry/thunderstorm presentation;
- business-day lighting cycle;
- portrait and landscape cinematic cameras;
- picking/dev-tool interaction enabled in a separate diagnostic run.

Capture at minimum:

- startup and scene-initialization cost;
- production bundle contribution and lazy-loading behavior;
- p50/p95 CPU frame cadence;
- GPU timing when available;
- draw calls and primitives;
- live geometries/textures/resources;
- active visual rigs versus logical actors;
- memory/GC evidence;
- semantic parity of authoritative actor/event projections.

## Cutover gate

#200 is the authoritative final gate. Babylon may become the sole production renderer only when:

- static world, stand, actors, mobility, ambient life, weather, camera, picking, and dev tooling have parity;
- simulation, occurrence, routing, persistence, accessibility, and feedback contracts remain renderer-neutral;
- required browser/mobile/accessibility/release checks pass with Babylon as default;
- the deterministic stress fixture meets the accepted performance/resource budgets;
- the critical application entry remains within its bundle contract through lazy engine loading;
- Three.js runtime/type dependencies and Three-only code can be removed without semantic or user-facing regression.

Until then, Three.js is reference infrastructure, not the long-term architectural direction.
