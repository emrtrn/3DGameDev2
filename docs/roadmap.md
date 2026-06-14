# 3DGameDev Roadmap

This workspace is the architecture-v2 migration clone of the reusable Three.js
single-codebase game template. The stable reference remains
`C:\Users\emret\Desktop\3DGameDev`.

## Current Direction

- Use `docs/ARCHITECTURE_PLAN_SOURCE.md` as the source architecture reference.
- Use `docs/MIGRATION_ROADMAP.md` as the execution plan.
- Keep one working `SceneApp` for both Game Mode (`/`) and Editor Mode
  (`/?editor`) until each extracted boundary is proven.
- Keep project data local under `public/` until the `project/` boundary is
  explicitly migrated.
- Keep production builds runtime-only.

## Near-Term Order

1. Phase 0: lock the baseline with `npm run build` and a dist string check.
2. Phase 1: add documented boundary skeletons without moving behavior.
3. Phase 2: extract serializable scene/data contracts.
4. Phase 3: extract asset manifest and lookup logic.
5. Phase 4+: move render/editor/builder modules in small build-passing steps.
