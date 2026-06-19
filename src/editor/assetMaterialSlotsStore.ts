/**
 * Editor-side saving of asset-level material slot sidecars (`*.materials.json`).
 */
import {
  materialSlotsSidecarPath,
  normalizeAssetMaterialSlots,
  type AssetMaterialSlotsDef,
} from "@/scene/assetMaterialSlotsLoader";

export {
  defaultAssetMaterialSlots,
  loadAssetMaterialSlots,
  materialSlotsSidecarPath,
  normalizeAssetMaterialSlots,
} from "@/scene/assetMaterialSlotsLoader";
export type { AssetMaterialSlotsDef } from "@/scene/assetMaterialSlotsLoader";

export async function saveAssetMaterialSlots(
  modelPath: string,
  materialSlots: AssetMaterialSlotsDef,
): Promise<{ path: string; changed: boolean }> {
  const path = materialSlotsSidecarPath(modelPath);
  const response = await fetch("/__save-material-slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, materialSlots: normalizeAssetMaterialSlots(materialSlots) }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Material slot save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}
