import type { LayoutReflection, LayoutSkyLightCapture } from "./layout";

/**
 * Render-agnostic Sky Light Capture model: resolved settings + defaults, shared
 * by the Sky Atmosphere-owned authoring model and the three.js render binding
 * (`engine/render-three/reflection.ts`). Kept free of three.js so editor core and
 * the save validator can read it without pulling in the renderer.
 *
 * The web/three counterpart to Unreal's **Sky Light static capture**: it
 * snapshots the Sky Atmosphere into a prefiltered (PMREM) environment map and
 * feeds it to every PBR (`MeshStandardMaterial`) surface as image-based
 * reflections plus an ambient bounce. The old editor-facing Reflection
 * Environment actor has been folded into Sky Atmosphere; this module remains as
 * the internal global IBL binding and as the fallback target for local probes.
 */
export type ReflectionSource = "sky";

type ReflectionInput = LayoutSkyLightCapture | LayoutReflection;

export interface ResolvedReflection {
  name: string;
  hidden: boolean;
  /** Where the captured environment comes from. Faz 1 only supports the sky. */
  source: ReflectionSource;
  /** Reflection + ambient bounce strength (maps to `scene.environmentIntensity`). */
  intensity: number;
}

export const REFLECTION_DEFAULTS: ResolvedReflection = {
  name: "Sky Light Capture",
  hidden: false,
  source: "sky",
  intensity: 1,
};

/** Fills every Reflection field with its default, decoupled from the layout. */
export function resolveReflection(
  actor: ReflectionInput | null | undefined,
): ResolvedReflection {
  const defaults = REFLECTION_DEFAULTS;
  if (!actor) return { ...defaults };
  const legacy = actor as LayoutReflection;
  return {
    name: legacy.name ?? defaults.name,
    hidden: legacy.hidden ?? defaults.hidden,
    source: legacy.source ?? defaults.source,
    intensity: actor.intensity ?? defaults.intensity,
  };
}
