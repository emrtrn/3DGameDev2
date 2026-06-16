# Forge

**Forge** is a reusable Three.js **game template** whose editor is a built-in
mode of the game (`?editor`), not a separate app. One `SceneApp` renders both
the game and the editor viewport; the engine/editor/builder/game module
boundaries are extracted under `engine/`, `editor/`, `builder/`, and `game/`.
The architecture is Unreal-inspired (viewport gizmos, outliner, details,
content browser, undo/redo, snapping, Play mode) but web-first and lightweight.

Forge grew out of the earlier `3DGameDev` project (legacy name). The stable
reference repo is `C:\Users\emret\Desktop\3DGameDev`; do not edit it from this
workspace. Do not rewrite from scratch — preserve working behavior and move
code in small, build-passing steps.

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
- `docs/UNREAL_BASICS_LESSONS.md`: the canonical roadmap. Top section is the
  **active execution track** (Gameplay/Runtime, G1–G6, with status legend +
  Progress Log); §1–§6 are the Unreal-derived architecture lessons (north star +
  backlog). The completed post-migration cleanup checklist
  (`IMPROVEMENT_CHECKLIST.md`) was removed; its history lives in git.

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
