import type { LayoutReflection } from "./layout";

/**
 * Render-agnostic Reflection Environment model: resolved settings + defaults,
 * shared by the editor view-models and the three.js render binding
 * (`engine/render-three/reflection.ts`). Kept free of three.js so editor core and
 * the save validator can read it without pulling in the renderer.
 *
 * The web/three counterpart to Unreal's **Sky Light static capture**: it snapshots
 * the Sky Atmosphere into a prefiltered (PMREM) environment map and feeds it to
 * every PBR (`MeshStandardMaterial`) surface as image-based reflections plus an
 * ambient bounce. Faz 1 captures only the sky (`source: "sky"`); a positional
 * Sphere Reflection Capture (per-probe local cubemaps with parallax) is
 * intentionally out of scope.
 */
export type ReflectionSource = "sky";

export interface ResolvedReflection {
  name: string;
  hidden: boolean;
  /** Where the captured environment comes from. Faz 1 only supports the sky. */
  source: ReflectionSource;
  /** Reflection + ambient bounce strength (maps to `scene.environmentIntensity`). */
  intensity: number;
}

export const REFLECTION_DEFAULTS: ResolvedReflection = {
  name: "Reflection Environment",
  hidden: false,
  source: "sky",
  intensity: 1,
};

/** Fills every Reflection field with its default, decoupled from the layout. */
export function resolveReflection(
  actor: LayoutReflection | null | undefined,
): ResolvedReflection {
  const defaults = REFLECTION_DEFAULTS;
  if (!actor) return { ...defaults };
  return {
    name: actor.name ?? defaults.name,
    hidden: actor.hidden ?? defaults.hidden,
    source: actor.source ?? defaults.source,
    intensity: actor.intensity ?? defaults.intensity,
  };
}
