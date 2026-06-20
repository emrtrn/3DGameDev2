import type { LayoutPostProcess } from "./layout";

export type PostProcessToneMapping = "aces" | "neutral" | "none";

export interface ResolvedPostProcess {
  name: string;
  hidden: boolean;
  exposure: number;
  toneMapping: PostProcessToneMapping;
  bloom: {
    enabled: boolean;
    threshold: number;
    intensity: number;
    radius: number;
  };
  vignette: {
    enabled: boolean;
    intensity: number;
    offset: number;
  };
  saturation: number;
  contrast: number;
}

export const POST_PROCESS_DEFAULTS: ResolvedPostProcess = {
  name: "Post Process",
  hidden: false,
  exposure: 1,
  toneMapping: "aces",
  bloom: {
    enabled: false,
    threshold: 0.9,
    intensity: 0.4,
    radius: 0.25,
  },
  vignette: {
    enabled: false,
    intensity: 0.35,
    offset: 1,
  },
  saturation: 1,
  contrast: 1,
};

/** Fills every Post Process field with its default, decoupled from the layout. */
export function resolvePostProcess(
  actor: LayoutPostProcess | null | undefined,
): ResolvedPostProcess {
  const defaults = POST_PROCESS_DEFAULTS;
  if (!actor) return { ...defaults };
  return {
    name: actor.name ?? defaults.name,
    hidden: actor.hidden ?? defaults.hidden,
    exposure: actor.exposure ?? defaults.exposure,
    toneMapping: actor.toneMapping ?? defaults.toneMapping,
    bloom: {
      ...defaults.bloom,
      ...actor.bloom,
    },
    vignette: {
      ...defaults.vignette,
      ...actor.vignette,
    },
    saturation: actor.saturation ?? defaults.saturation,
    contrast: actor.contrast ?? defaults.contrast,
  };
}
