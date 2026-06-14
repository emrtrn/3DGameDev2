# Editor Render Three

Editor-only Three.js helpers live here.

Current files:

- `transformMatrices.ts`: editable transform compose/decompose helpers backed by Three matrices.

Rules:

- This folder may import Three.js and editor contracts.
- Runtime game code must not import this folder.
- Pure editor state helpers belong in `editor/core`, not here.
