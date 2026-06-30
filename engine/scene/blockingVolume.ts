import type { BrushShape, LayoutBlockingVolume, Vec3 } from "./layout";
import type { AssetCollisionDef } from "./collision";

/**
 * Render-agnostic Blocking Volume model: resolved settings + defaults, shared by
 * the editor view-models, the save validator, and the three.js render binding
 * (`engine/render-three/blockingVolume.ts`). Kept free of three.js so editor core
 * and the validator can read it without pulling in the renderer.
 *
 * A Blocking Volume is the web/three counterpart to Unreal's BlockingVolume / brush
 * volumes: a parametric primitive (box / cylinder / cone / sphere) used for blockout
 * and grey-boxing. It is a **placed actor with a transform** plus its own brush
 * `size`, so it can be reshaped and resized numerically — there can be many.
 */
export const BRUSH_SHAPES: readonly BrushShape[] = ["box", "cylinder", "cone", "sphere"];

export function isBrushShape(value: unknown): value is BrushShape {
  return typeof value === "string" && (BRUSH_SHAPES as readonly string[]).includes(value);
}

export interface ResolvedBlockingVolume {
  name: string;
  hidden: boolean;
  brushShape: BrushShape;
  /** Brush dimensions in world units (`[x, y, z]`). */
  size: Vec3;
  /** Draw as a solid grey-box in Play (off = invisible-but-blocking). */
  renderInGame: boolean;
  /** Editor brush tint (hex `#rrggbb`). */
  color: string;
}

/** Default brush size: a ~4 m blockout cube at the ~1u≈2m scene scale. */
export const DEFAULT_BRUSH_SIZE: Vec3 = [2, 2, 2];

export const BLOCKING_VOLUME_DEFAULTS: ResolvedBlockingVolume = {
  name: "Blocking Volume",
  hidden: false,
  brushShape: "box",
  size: [...DEFAULT_BRUSH_SIZE],
  renderInGame: false,
  // Unreal's brush wireframe orange.
  color: "#ff8c1a",
};

/** Fills every Blocking Volume field with its default, decoupled from the layout. */
export function resolveBlockingVolume(
  actor: LayoutBlockingVolume | null | undefined,
): ResolvedBlockingVolume {
  const defaults = BLOCKING_VOLUME_DEFAULTS;
  if (!actor) return { ...defaults, size: [...defaults.size] };
  return {
    name: actor.name ?? defaults.name,
    hidden: actor.hidden ?? defaults.hidden,
    brushShape: isBrushShape(actor.brushShape) ? actor.brushShape : defaults.brushShape,
    size: actor.size ? [...actor.size] : [...defaults.size],
    renderInGame: actor.renderInGame ?? defaults.renderInGame,
    color: actor.color ?? defaults.color,
  };
}

/** A stable, collision-free id for a new blocking volume (`blocking-volume-<n>`). */
export function uniqueBlockingVolumeId(volumes: LayoutBlockingVolume[]): string {
  const existing = new Set(volumes.map((volume) => volume.id));
  let index = 1;
  while (existing.has(`blocking-volume-${index}`)) index += 1;
  return `blocking-volume-${index}`;
}

/** A unique display name for a new blocking volume, suffixing on collision. */
export function uniqueBlockingVolumeName(
  baseName: string,
  volumes: LayoutBlockingVolume[],
): string {
  const existing = new Set(volumes.map((volume) => volume.name ?? volume.id));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}

/**
 * Asset-level collision for a blocking volume: one solid primitive matching the
 * brush shape, sized to the brush `size` (full extents). Mirrors
 * {@link shapePrimitiveCollisionDef} in `engine/scene/shapes.ts`. The runtime bakes
 * the placement scale into this primitive, so the collider tracks the rendered
 * brush exactly.
 */
export function blockingVolumeCollisionDef(shape: BrushShape, size: Vec3): AssetCollisionDef {
  const solid: Vec3 = [size[0], size[1], size[2]];
  return {
    primitives: [{ shape, size: solid }],
    complexity: "projectDefault",
    preset: "blockAll",
  };
}
