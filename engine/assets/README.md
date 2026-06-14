# Engine Assets

This folder owns serializable asset contracts and pure asset lookup helpers.

Current files:

- `manifest.ts`: runtime asset manifest/catalog types, editable-asset projection,
  group lookup, byte totals, and ID lookup helpers.

Rules:

- Runtime and editor data should refer to assets by stable asset IDs.
- Serialized scene/layout data must not use absolute filesystem paths.
- Public URLs and `fetch` belong in adapter code, not in these pure contracts.
- Three.js `GLTFLoader`, meshoptimizer, textures, and runtime objects do not
  belong in this folder; they stay in render/loader adapter modules.
- Catalog metadata may describe authoring behavior, but gameplay rules should
  live in game/project code.
