/**
 * Built-in primitive shape descriptors (Cube/Sphere/Cylinder/Cone/Plane).
 *
 * Shape actors are stored as ordinary model instances whose `assetId` is a
 * synthetic `shape:<type>` id rather than a manifest asset. This module is the
 * dependency-free (no three.js) source of truth for the id encoding + labels so
 * both the editor UI chunk and the render layer can share it. The three.js
 * geometry builder lives in `src/scene/shapePrimitives.ts`.
 */

export const SHAPE_PRIMITIVE_TYPES = [
  "cube",
  "sphere",
  "cylinder",
  "cone",
  "plane",
] as const;

export type ShapePrimitiveType = (typeof SHAPE_PRIMITIVE_TYPES)[number];

const SHAPE_ASSET_PREFIX = "shape:";

/** Encode a primitive type as the synthetic asset id stored in the layout. */
export function shapeAssetId(type: ShapePrimitiveType): string {
  return `${SHAPE_ASSET_PREFIX}${type}`;
}

/** Decode a `shape:<type>` asset id back to its primitive type, or null. */
export function parseShapeAssetId(assetId: string): ShapePrimitiveType | null {
  if (!assetId.startsWith(SHAPE_ASSET_PREFIX)) return null;
  const type = assetId.slice(SHAPE_ASSET_PREFIX.length);
  return (SHAPE_PRIMITIVE_TYPES as readonly string[]).includes(type)
    ? (type as ShapePrimitiveType)
    : null;
}

export function isShapeAssetId(assetId: string): boolean {
  return parseShapeAssetId(assetId) !== null;
}

export function isShapePrimitiveType(value: unknown): value is ShapePrimitiveType {
  return (
    typeof value === "string" &&
    (SHAPE_PRIMITIVE_TYPES as readonly string[]).includes(value)
  );
}

export function formatShapeType(type: ShapePrimitiveType): string {
  switch (type) {
    case "cube":
      return "Cube";
    case "sphere":
      return "Sphere";
    case "cylinder":
      return "Cylinder";
    case "cone":
      return "Cone";
    case "plane":
      return "Plane";
  }
}
