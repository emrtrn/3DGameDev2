# Engine Behavior

Generic, DOM-free behavior tick layer for the engine spine.

Current files:

- `behaviorSubsystem.ts`: a `Subsystem` that ticks registered behavior scripts
  against a live set of entities derived from the scene. Behaviors mutate a
  per-entity transform; a host-provided sink syncs transforms back to render.
  Also exports the `BehaviorUpdate` / `BehaviorContext` / `BehaviorRegistry`
  contract that runtime/game behaviors implement.

Rules:

- No Three.js, DOM, Rapier, or editor imports here.
- The concrete behavior registry (script id -> update function) is game content
  and lives in a runtime location (`src/game/`), not here.
- Value imports use relative paths so the engine-test bundler (which resolves no
  path aliases) can bundle this folder.
