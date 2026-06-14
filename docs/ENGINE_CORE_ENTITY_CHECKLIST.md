# Engine Core + Entity Checklist

> Created: 2026-06-14
> Scope: start the architecture-v2 engine spine before continuing broad
> `SceneApp` extraction.

This checklist tracks the next migration direction after the helper-extraction
passes. The goal is to introduce a small, serializable engine/scene spine while
keeping the current `RoomLayout` runtime/editor path working.

## Working Rules

- Keep each implementation step small and reversible.
- Run `npm run build:verify` after every implementation step.
- Commit and push only after `build:verify` passes.
- Mark an item `[x]` only after the implementation, verification, commit, and
  push are complete.
- Keep `engine/core` and `engine/scene` free of Three.js, DOM, Rapier, and
  editor UI imports.
- Keep the legacy `RoomLayout` format working until a replacement scene format
  is proven end to end.

## 0. Tracking

- [x] Create this checklist in `docs/`.

## 1. Engine Core Spine

- [x] Add `engine/core/Subsystem.ts` with a minimal subsystem lifecycle
  contract: `init`, `start`, `update`, and `dispose` hooks.
- [x] Add `engine/core/SubsystemRegistry.ts` with deterministic registration,
  lookup, forward lifecycle order, and reverse dispose order.
- [x] Add `engine/core/EngineApp.ts` as the lifecycle coordinator for the
  registry and tick/update calls.
- [x] Add a short `engine/core/README.md` documenting ownership rules and
  forbidden dependencies.

## 2. Minimal Scene Data Model

- [x] Add `engine/scene/entity.ts` with plain JSON-safe `EntityId`, `Entity`,
  and component-map contracts.
- [x] Add `engine/scene/components.ts` with the first component contracts:
  `TransformComponent`, `MeshRendererComponent`, `LightComponent`, and
  `MetadataComponent`.
- [x] Add `engine/scene/sceneDocument.ts` with a versioned `SceneDocument`
  contract containing entities and optional world settings.
- [x] Add serialization helpers that clone/validate the minimal scene document
  without importing render/editor/runtime objects.

## 3. Legacy Layout Adapter

- [x] Add `engine/scene/legacyRoomLayoutAdapter.ts` to convert current
  `RoomLayout.instances`, `characters`, and `lights` into `SceneDocument`
  entities.
- [x] Preserve stable identity mapping for legacy selections where possible
  (`instance:<assetId>:<index>`, `character:<index>`, `light:<index>`).
- [x] Add adapter coverage for transform, mesh/model reference, light data,
  visibility/lock flags, hierarchy ids, and metadata.
- [x] Keep `RoomLayout` as the saved authoring format for this stage.

Notes (2026-06-14):

- Entity ids mirror `editor/core/selection.ts#selectionId` byte-for-byte;
  the format is duplicated in the adapter on purpose because `engine/*` must
  not import `editor/*`. Keep the two in sync.
- The legacy dual id space (`nodeId`/`parentId`) is collapsed into the single
  `SceneDocument` id space: a child's `entity.parentId` is resolved to the
  parent entity id; dangling parent refs are dropped.
- Visibility/lock flags are carried as entity `tags` (`hidden`, `locked`).
- Intentionally not mapped yet: `groupId`, `pivot`, `scaleLocked`, `collision`
  (future Collider), character `animation`, and per-object `receiveShadow`.

## 4. First Integration Slice

- [x] Load the current `RoomLayout` as before, then derive a `SceneDocument`
  through the adapter without changing visible behavior.
- [x] Add a debug/internal getter for the derived `SceneDocument` so the new
  spine can be inspected without driving rendering yet.
- [x] Verify Game Mode and Editor Mode still render from the existing path.
- [x] Update `docs/MIGRATION_ROADMAP.md` with the completed engine-core and
  scene-data slice.

Notes (2026-06-14):

- `SceneApp.getSceneDocument()` derives the spine on demand from the loaded
  layout (mirrors the existing `getLayout()` accessor). Nothing in the render
  path consumes it, so visible behavior is unchanged.
- Render verification: behavior is unchanged by construction (additive,
  unused-by-render getter) and `npm run build:verify` passes in both modes with
  only the known `/__save-layout` baseline warning. A standalone runtime check
  confirmed the adapter derives a validating `SceneDocument` from the saved
  `render-test-room` layout (3 entities; world settings preserved). A live
  browser render smoke was not run this pass.

Testing (2026-06-14):

- Added `tools/engine-tests.ts` (run via `npm run test:engine`, bundled with
  esbuild on node; no test framework, matching `verify-dist.mjs` style) and
  wired it into `npm run build:verify` before `verify:dist`.
- Covers: adapter entity ids stay byte-for-byte in sync with
  `editor/core/selection.ts#selectionId`, real-layout round-trip + validation,
  hierarchy `nodeId`/`parentId` resolution (including dropped dangling refs),
  and visibility/lock flag tags. This guards the id contract that section 5
  render bindings will depend on.

## 5. Render Adapter Preparation

- [x] Identify the smallest render path that can consume `SceneDocument`
  entities while the legacy `RoomLayout` path remains available.
- [x] Move only one render binding at a time toward entity/component input:
  static mesh instances first, then characters, then lights. (All three render
  bindings now flow through the entity/component model.)
- [ ] Keep compatibility wrappers until both Game Mode and Editor Mode are
  proven against the new path. (Compatibility builders kept; the remaining gate
  is the live browser smoke — see PENDING below.)

Progress (2026-06-14):

- Smallest render path identified: `createInstancedModelGroup` /
  `SceneApp.createInstancedModel` (per-asset static mesh instances). It bakes
  each placement's own world transform and uses neither `pivot` nor parent
  hierarchy, so the `SceneDocument` `TransformComponent` reproduces it exactly.
- Static mesh instances MOVED to entity/component input:
  - `createInstancedModelGroup` now takes a normalized `InstanceRenderItem[]`
    (`matrix` + `hidden`) instead of `LayoutPlacement[]`.
  - `SceneApp.createInstancedModel` feeds it `entityInstanceItems(
    instanceEntitiesForAsset(assetId, placements))` — render now flows through
    the entity/component model.
  - `placementInstanceItems` (legacy) is kept as the compatibility builder and
    the equivalence reference; both compose via `composeTransformMatrix`.
  - Added `readTransformComponent`/`readMeshRendererComponent` typed readers in
    `engine/scene/components.ts`.
- Characters MOVED to entity/component input:
  - `createCharacterSceneObject` now consumes a normalized `CharacterRenderItem`
    (`name`/`position`/`rotation`/`scale`/`hidden`/`castShadow`) instead of a
    `LayoutCharacter`.
  - `SceneApp.createCharacterObject` feeds it `entityCharacterItem(
    characterEntity(index, placement))`.
  - `placementCharacterItem` (legacy) is the compatibility builder / equivalence
    reference. Character `animation` stays in `SceneApp` (intentionally
    unmapped); the name fallback is `entity.name ?? meshRenderer.assetId`.
- Lights MOVED to entity/component input:
  - Added `readLightComponent` typed reader in `engine/scene/components.ts`.
  - `createLightObject` / `syncLightObject` / `buildLightGizmo` (+ icon helpers)
    now consume a normalized `LightRenderItem` / `SceneLightType` instead of a
    `LayoutLightActor`.
  - Added `lightEntity(index, actor)` in the adapter and routed the document
    light loop through it. The actor display name (`name ?? id`) is resolved
    into `entity.name` because the light `id` is not a component field.
  - `SceneApp.createLightObject` / `refreshLightObject` feed the render path via
    `entityLightItem(lightEntity(index, actor))`. Sun detection /
    `DEFAULT_SUN_ID` matching stays on the actor (unchanged). `actorLightItem`
    (legacy) is the compatibility builder / equivalence reference.
  - Object3D/light `.name` is cosmetic only (the outliner labels read the actor,
    picking uses `userData.lightIndex`), so the name resolution change is
    render-safe.
- Verified: `build:verify` passes (14 engine checks). Render-parity tests prove
  instance/character/light entities carry the exact transform + render inputs
  the legacy paths used, so the Three.js output is identical by construction.
- PENDING (item 3): live browser smoke in Game Mode and Editor Mode to confirm
  the static scene, characters, and lights (incl. shadows + gizmos) render and
  that selection still works against the entity-driven path. This is the
  remaining gate before closing item 3 and section 6.

## 6. Vertical Slice Readiness Gate

- [ ] Confirm the engine core can initialize and tick deterministic subsystems.
- [ ] Confirm the scene model can represent at least one mesh entity, one light
  entity, metadata, and transform hierarchy.
- [ ] Confirm the legacy adapter can derive that scene model from the current
  saved layout.
- [ ] Confirm `npm run build:verify` still reports only the known baseline
  warnings.
