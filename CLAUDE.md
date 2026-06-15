# 3DGameDev Architecture V2 Migration

This workspace is `3DGameDev-architecture-v2`, the migration clone for the
architecture-v2 refactor. The stable reference repo is
`C:\Users\emret\Desktop\3DGameDev`.

The current app is still a reusable Three.js **game template** whose editor is a
built-in mode of the game (`?editor`), not a separate app. One `SceneApp`
renders both the game and the editor viewport while the migration extracts
engine/editor/builder boundaries.

Do not rewrite from scratch. Preserve working behavior and move code in small,
build-passing steps according to the roadmap.

`home-makeover` (`C:\Users\emret\Desktop\home-makeover`) is a separate project
for now; it will later be rebuilt as a copy of this template. This codebase no
longer edits it.

## Modes (routes)

- **Game Mode**: `http://127.0.0.1:5173/` - runtime render, no editor UI.
- **Editor Mode**: `http://127.0.0.1:5173/?editor` (add `&debug` for the perf
  overlay) - same SceneApp + `EditorUi`, which is dynamically imported so the
  game bundle excludes it.
- `?debug`: perf overlay in either mode.

## Docs

- `docs/ARCHITECTURE.md`: boundary contract.
- `docs/ARCHITECTURE_PLAN_SOURCE.md`: imported source architecture plan.
- `docs/LAUNCH_WORKFLOW.md`: practical VS Code and URL launch path.

## Working Rules

- Keep the editor core generic; project-specific game rules live in game runtime
  code/data, not the editor.
- Keep the stable `C:\Users\emret\Desktop\3DGameDev` repo untouched from this
  workspace.
- The editor (`src/editor/`) must stay behind the dynamic `?editor` import so it
  is excluded from the game build.
- Project data is local: the game/editor read this repo's own `public/`
  (`public/project.3dgame.json`, `public/layouts/*.json`, `public/assets/*`).
  Manifest paths are relative to the public root.
- After editing TypeScript, run `npx tsc --noEmit`; the dev server skips
  type-checking.
- **Save-validator allowlist gotcha:** any new `LayoutPlacement` /
  `LayoutCharacter` / `LayoutLightActor` field must be added to the
  `vite.config.ts` save validator (`applyTransformFields` /
  `validateLightActor`) or it is silently dropped on save.

## Authoring Data Flow

- `/__save-layout` writes the layout to `public/<defaultScene>` and snap settings
  to `public/project.3dgame.json`.
- `/__project-dir` is the read-only Content Browser directory tree, scoped to
  `public/`.
- These dev endpoints do not exist in the production build.

## Current Capabilities

- Viewport camera (MMB pan / orbit / dolly), transform gizmo
  (move/rotate/scale with dual-axis plane handles, hover highlight),
  world-space + local transform.
- Selection, multi-select, groups, parent/child hierarchy (outliner tree,
  drag-to-parent, cascade move/rotate/scale), pivot editing (numeric + presets
  + drag-in-viewport).
- Scene Outliner, Details panel (transform + schema-driven gameplay metadata),
  Content Browser, undo/redo command stack, World Settings (background/ambient
  with autosave).

## Near-Term Order

1. Optional: split editor-only logic out of the main bundle (`SceneApp` still
   ships gizmo/authoring code in the game chunk).
2. Smoke tests around load/save and the game/editor mode split.
3. Improve asset catalog UI with previews and placement-rule affordances.
4. Later: migrate `home-makeover` onto a copy of this template.
