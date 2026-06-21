import type { LayoutReflectionPlane } from "./layout";

/**
 * Render-agnostic Planar Reflection model: resolved settings + defaults, shared by
 * the editor view-models and the three.js render binding
 * (`engine/render-three/reflectionPlane.ts`). Kept free of three.js so editor core
 * and the save validator can read it without pulling in the renderer.
 *
 * A Planar Reflection plane is the web/three counterpart to Unreal's Planar
 * Reflection: a flat mirror surface (water, polished floor, mirror) that renders
 * the scene from a mirrored camera each frame (three.js `Reflector`). Unlike the
 * singleton environment actors it is a **placed actor with a transform** — there
 * can be many, each positioned/rotated/scaled in the world.
 */
export interface ResolvedReflectionPlane {
  name: string;
  hidden: boolean;
  /** Mirror tint multiplied over the reflected image (hex `#rrggbb`). */
  color: string;
  /** Reflection render-target resolution in px (higher = sharper, costlier). */
  resolution: number;
}

export const REFLECTION_PLANE_DEFAULTS: ResolvedReflectionPlane = {
  // Named "Mirror Plane" — its only use is a flat mirror surface.
  name: "Mirror Plane",
  hidden: false,
  color: "#888888",
  resolution: 512,
};

/** Fills every Reflection Plane field with its default, decoupled from the layout. */
export function resolveReflectionPlane(
  actor: LayoutReflectionPlane | null | undefined,
): ResolvedReflectionPlane {
  const defaults = REFLECTION_PLANE_DEFAULTS;
  if (!actor) return { ...defaults };
  return {
    name: actor.name ?? defaults.name,
    hidden: actor.hidden ?? defaults.hidden,
    color: actor.color ?? defaults.color,
    resolution: actor.resolution ?? defaults.resolution,
  };
}

/** A stable, collision-free id for a new reflection plane (`reflection-plane-<n>`). */
export function uniqueReflectionPlaneId(planes: LayoutReflectionPlane[]): string {
  const existing = new Set(planes.map((plane) => plane.id));
  let index = 1;
  while (existing.has(`reflection-plane-${index}`)) index += 1;
  return `reflection-plane-${index}`;
}

/** A unique display name for a new reflection plane, suffixing on collision. */
export function uniqueReflectionPlaneName(
  baseName: string,
  planes: LayoutReflectionPlane[],
): string {
  const existing = new Set(planes.map((plane) => plane.name ?? plane.id));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}
