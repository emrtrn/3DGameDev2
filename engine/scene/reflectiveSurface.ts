import type { LayoutReflectiveSurface } from "./layout";

/**
 * Render-agnostic Reflective Surface model: resolved settings + defaults, shared by
 * the editor view-models and the three.js render binding
 * (`engine/render-three/reflectiveSurface.ts`). Kept free of three.js so editor core
 * and the save validator can read it without pulling in the renderer.
 *
 * A Reflective Surface is the textured, PBR counterpart to the pure mirror
 * {@link LayoutReflectionPlane}: a flat surface (road / floor / lake / sea) that
 * renders a per-frame planar reflection and composites it into a real material
 * (albedo + normal map + roughness) via a fresnel-weighted blend — so it reads as a
 * believable wet/glossy surface, not a chrome mirror. Like the Planar Reflection it
 * is a **placed actor with a transform** (array, many per scene).
 */
export interface ResolvedReflectiveSurface {
  name: string;
  hidden: boolean;
  /** Material asset id (`*.material.json`); null = built-in glossy default material. */
  material: string | null;
  /** Overall planar-reflection contribution, 0 (none) .. 1 (full mirror at grazing). */
  reflectionStrength: number;
  /** Fresnel exponent: higher = reflection concentrated at grazing angles. */
  fresnelPower: number;
  /** Minimum reflection seen head-on (0 = pure fresnel, 1 = uniform mirror). */
  fresnelBias: number;
  /** Normal-map-driven screen-space distortion of the reflection (0 = sharp planar). */
  distortion: number;
  /** Reflection tint multiplied over the reflected image (hex `#rrggbb`). */
  tint: string;
  /** Reflection render-target resolution in px (higher = sharper, costlier). */
  resolution: number;
}

export const REFLECTIVE_SURFACE_DEFAULTS: ResolvedReflectiveSurface = {
  name: "Reflective Surface",
  hidden: false,
  material: null,
  reflectionStrength: 0.6,
  fresnelPower: 4,
  fresnelBias: 0.02,
  distortion: 0.05,
  tint: "#ffffff",
  resolution: 512,
};

/** Fills every Reflective Surface field with its default, decoupled from the layout. */
export function resolveReflectiveSurface(
  actor: LayoutReflectiveSurface | null | undefined,
): ResolvedReflectiveSurface {
  const defaults = REFLECTIVE_SURFACE_DEFAULTS;
  if (!actor) return { ...defaults };
  return {
    name: actor.name ?? defaults.name,
    hidden: actor.hidden ?? defaults.hidden,
    material: actor.material ?? defaults.material,
    reflectionStrength: actor.reflectionStrength ?? defaults.reflectionStrength,
    fresnelPower: actor.fresnelPower ?? defaults.fresnelPower,
    fresnelBias: actor.fresnelBias ?? defaults.fresnelBias,
    distortion: actor.distortion ?? defaults.distortion,
    tint: actor.tint ?? defaults.tint,
    resolution: actor.resolution ?? defaults.resolution,
  };
}

/** A stable, collision-free id for a new reflective surface (`reflective-surface-<n>`). */
export function uniqueReflectiveSurfaceId(surfaces: LayoutReflectiveSurface[]): string {
  const existing = new Set(surfaces.map((surface) => surface.id));
  let index = 1;
  while (existing.has(`reflective-surface-${index}`)) index += 1;
  return `reflective-surface-${index}`;
}

/** A unique display name for a new reflective surface, suffixing on collision. */
export function uniqueReflectiveSurfaceName(
  baseName: string,
  surfaces: LayoutReflectiveSurface[],
): string {
  const existing = new Set(surfaces.map((surface) => surface.name ?? surface.id));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}
