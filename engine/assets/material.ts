export const FORGE_MATERIAL_TYPES = ["standard", "basic"] as const;
export type ForgeMaterialType = (typeof FORGE_MATERIAL_TYPES)[number];

export const FORGE_MATERIAL_SIDES = ["front", "back", "double"] as const;
export type ForgeMaterialSide = (typeof FORGE_MATERIAL_SIDES)[number];

export const FORGE_MATERIAL_ALPHA_MODES = ["opaque", "blend", "mask"] as const;
export type ForgeMaterialAlphaMode = (typeof FORGE_MATERIAL_ALPHA_MODES)[number];

export const FORGE_MATERIAL_PRESETS = [
  "standard",
  "textured",
  "metal",
  "glass",
  "emissive",
  "basic",
] as const;
export type ForgeMaterialPreset = (typeof FORGE_MATERIAL_PRESETS)[number];

export interface ForgeMaterialDef {
  schema: 1;
  type: "material";
  materialType: ForgeMaterialType;
  name: string;
  baseColor: string;
  baseColorTexture: string | null;
  normalTexture: string | null;
  maskTexture: string | null;
  roughness: number;
  metalness: number;
  opacity: number;
  alphaMode: ForgeMaterialAlphaMode;
  alphaTest: number;
  side: ForgeMaterialSide;
  emissive: string;
  emissiveIntensity: number;
}

export function isForgeMaterialPreset(value: unknown): value is ForgeMaterialPreset {
  return typeof value === "string" && FORGE_MATERIAL_PRESETS.includes(value as ForgeMaterialPreset);
}

export function isForgeMaterialType(value: unknown): value is ForgeMaterialType {
  return typeof value === "string" && FORGE_MATERIAL_TYPES.includes(value as ForgeMaterialType);
}

export function isForgeMaterialSide(value: unknown): value is ForgeMaterialSide {
  return typeof value === "string" && FORGE_MATERIAL_SIDES.includes(value as ForgeMaterialSide);
}

export function isForgeMaterialAlphaMode(value: unknown): value is ForgeMaterialAlphaMode {
  return (
    typeof value === "string" &&
    FORGE_MATERIAL_ALPHA_MODES.includes(value as ForgeMaterialAlphaMode)
  );
}

export function defaultForgeMaterialDef(
  name: string,
  preset: ForgeMaterialPreset = "standard",
): ForgeMaterialDef {
  const base: ForgeMaterialDef = {
    schema: 1,
    type: "material",
    materialType: "standard",
    name,
    baseColor: "#ffffff",
    baseColorTexture: null,
    normalTexture: null,
    maskTexture: null,
    roughness: 0.8,
    metalness: 0,
    opacity: 1,
    alphaMode: "opaque",
    alphaTest: 0.5,
    side: "front",
    emissive: "#000000",
    emissiveIntensity: 0,
  };

  if (preset === "textured") {
    return { ...base, roughness: 0.75 };
  }
  if (preset === "metal") {
    return { ...base, baseColor: "#b9c0c7", roughness: 0.3, metalness: 1 };
  }
  if (preset === "glass") {
    return {
      ...base,
      baseColor: "#bfe9ff",
      roughness: 0.05,
      opacity: 0.35,
      alphaMode: "blend",
      side: "double",
    };
  }
  if (preset === "emissive") {
    return {
      ...base,
      baseColor: "#46b5ff",
      roughness: 0.4,
      emissive: "#46b5ff",
      emissiveIntensity: 1.5,
    };
  }
  if (preset === "basic") {
    return { ...base, materialType: "basic", roughness: 1 };
  }
  return base;
}

export function normalizeForgeMaterialDef(value: unknown, fallbackName = "Material"): ForgeMaterialDef {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const opacity = clamp01(numberOr(input.opacity, 1));
  const alphaMode = isForgeMaterialAlphaMode(input.alphaMode)
    ? input.alphaMode
    : opacity < 1
      ? "blend"
      : "opaque";
  return {
    schema: 1,
    type: "material",
    materialType: isForgeMaterialType(input.materialType) ? input.materialType : "standard",
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : fallbackName,
    baseColor: colorOr(input.baseColor, "#ffffff"),
    baseColorTexture: textureRefOrNull(input.baseColorTexture),
    normalTexture: textureRefOrNull(input.normalTexture),
    maskTexture: textureRefOrNull(input.maskTexture),
    roughness: clamp01(numberOr(input.roughness, 0.8)),
    metalness: clamp01(numberOr(input.metalness, 0)),
    opacity,
    alphaMode,
    alphaTest: clamp01(numberOr(input.alphaTest, 0.5)),
    side: isForgeMaterialSide(input.side) ? input.side : "front",
    emissive: colorOr(input.emissive, "#000000"),
    emissiveIntensity: Math.max(0, numberOr(input.emissiveIntensity, 0)),
  };
}

function numberOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function colorOr(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function textureRefOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
