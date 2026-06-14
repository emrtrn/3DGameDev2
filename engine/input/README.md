# Engine Input

DOM-free input mapping for the engine spine.

Current files:

- `actionMap.ts`: pure raw-code -> named-action mapping with per-tick
  pressed/held/released edges. No DOM, no `engine/core`, no render imports.
- `inputSubsystem.ts`: a `Subsystem` that calls `ActionMap.advance()` once per
  engine tick. Register it before any behavior subsystem.

Rules:

- No DOM, Three.js, Rapier, or editor imports here.
- A DOM input source (browser key/pointer events) lives in a runtime location
  (`src/`) and feeds raw codes into the action map; it must not live here.
- `engine/core` must not import this folder.
