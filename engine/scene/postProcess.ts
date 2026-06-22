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
  chromaticAberration: {
    enabled: boolean;
    amount: number;
  };
  grain: {
    enabled: boolean;
    intensity: number;
  };
  dof: {
    enabled: boolean;
    focusDistance: number;
    aperture: number;
    maxBlur: number;
  };
  saturation: number;
  contrast: number;
  /** White-balance temperature; 0 is neutral, positive warms, negative cools. */
  temperature: number;
  /** White-balance tint; 0 is neutral, positive shifts magenta, negative green. */
  tint: number;
}

export const POST_PROCESS_DEFAULTS: ResolvedPostProcess = {
  name: "Post Process",
  hidden: false,
  exposure: 1,
  toneMapping: "aces",
  bloom: {
    enabled: false,
    threshold: 1,
    intensity: 1,
    radius: 1,
  },
  vignette: {
    enabled: false,
    intensity: 0.35,
    offset: 1,
  },
  chromaticAberration: {
    enabled: false,
    amount: 0.5,
  },
  grain: {
    enabled: false,
    intensity: 0.5,
  },
  dof: {
    enabled: false,
    focusDistance: 10,
    aperture: 1,
    maxBlur: 1,
  },
  saturation: 1,
  contrast: 1,
  temperature: 0,
  tint: 0,
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
    chromaticAberration: {
      ...defaults.chromaticAberration,
      ...actor.chromaticAberration,
    },
    grain: {
      ...defaults.grain,
      ...actor.grain,
    },
    dof: {
      ...defaults.dof,
      ...actor.dof,
    },
    saturation: actor.saturation ?? defaults.saturation,
    contrast: actor.contrast ?? defaults.contrast,
    temperature: actor.temperature ?? defaults.temperature,
    tint: actor.tint ?? defaults.tint,
  };
}
