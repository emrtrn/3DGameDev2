# Engine Render Three

This folder owns Three.js adapter code as it is extracted from the current
`src/scene` implementation.

Current files:

- `gltfModelLoader.ts`: GLTFLoader + meshoptimizer adapter with per-asset
  promise caching.

Rules:

- Three.js runtime objects may live here.
- Serializable scene, asset, and project data must not depend on this folder.
- Editor overlays and gizmos may use this adapter later, but editor state should
  remain editor-owned.
