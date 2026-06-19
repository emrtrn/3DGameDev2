/**
 * Loads asset-level material slot assignments (`*.materials.json` sidecars).
 * Reads are plain static fetches from `public/`, so this is safe for runtime
 * and editor. Editor-only writes live in `assetMaterialSlotsStore`.
 */
import { projectFileUrl } from "@/project/ProjectSystem";

export interface AssetMaterialSlotsDef {
  schema: 1;
  slots: string[];
}

export function materialSlotsSidecarPath(modelPath: string): string {
  const normalized = modelPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const withoutExt = normalized.replace(/\.[^./]+$/, "");
  return `${withoutExt}.materials.json`;
}

export function defaultAssetMaterialSlots(): AssetMaterialSlotsDef {
  return { schema: 1, slots: [] };
}

export async function loadAssetMaterialSlots(modelPath: string): Promise<AssetMaterialSlotsDef> {
  const url = projectFileUrl(materialSlotsSidecarPath(modelPath));
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return defaultAssetMaterialSlots();
    return normalizeAssetMaterialSlots(await response.json());
  } catch {
    return defaultAssetMaterialSlots();
  }
}

export function normalizeAssetMaterialSlots(value: unknown): AssetMaterialSlotsDef {
  if (!value || typeof value !== "object") return defaultAssetMaterialSlots();
  const input = value as Record<string, unknown>;
  const rawSlots = Array.isArray(input.slots) ? input.slots : [];
  return {
    schema: 1,
    slots: rawSlots.filter((slot): slot is string => typeof slot === "string" && slot.length > 0),
  };
}
