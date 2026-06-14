# Engine Physics

Pure engine physics layer.

- `physicsSubsystem.ts`: deterministic placeholder physics that derives AABB
  contacts from `Transform` + `Collider` components and exposes them through a
  query contract. No Three.js, DOM, WASM, or editor imports.
