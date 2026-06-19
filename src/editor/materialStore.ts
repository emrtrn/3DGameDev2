import {
  normalizeForgeMaterialDef,
  type ForgeMaterialDef,
} from "@engine/assets/material";
import { projectFileUrl } from "@/project/ProjectSystem";

export async function loadMaterialAsset(
  path: string,
  fallbackName = "Material",
): Promise<ForgeMaterialDef> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return normalizeForgeMaterialDef({ name: fallbackName }, fallbackName);
    return normalizeForgeMaterialDef(await response.json(), fallbackName);
  } catch {
    return normalizeForgeMaterialDef({ name: fallbackName }, fallbackName);
  }
}

export async function saveMaterialAsset(
  path: string,
  material: ForgeMaterialDef,
): Promise<{ path: string; changed: boolean }> {
  const response = await fetch("/__save-material", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, material }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Material save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}
