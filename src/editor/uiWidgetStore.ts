/**
 * UI Widget asset I/O for the editor (dev-only).
 *
 * Loads a `*.ui.json` from the project public root and saves it back through the
 * dev `/__save-ui` endpoint, which re-validates + normalizes the payload server
 * side (see `tools/saveValidator.ts#validateSaveUiPayload`). Mirrors
 * `materialStore.ts`.
 */
import { normalizeUiWidgetDef, type UiWidgetDef } from "@engine/ui/uiWidget";
import { normalizeUiThemeDef, type UiThemeDef } from "@engine/ui/uiTheme";
import { assetPath, type AssetManifest } from "@engine/assets/manifest";
import { loadActiveProject, projectFileUrl } from "@/project/ProjectSystem";

export async function loadUiWidgetAsset(
  path: string,
  fallbackName = "Widget",
): Promise<UiWidgetDef> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return normalizeUiWidgetDef({ name: fallbackName }, fallbackName);
    return normalizeUiWidgetDef(await response.json(), fallbackName);
  } catch {
    return normalizeUiWidgetDef({ name: fallbackName }, fallbackName);
  }
}

/**
 * Resolves a widget `theme` reference (manifest asset id first, else a direct
 * public-relative path) to its theme def, mirroring
 * `RuntimeSceneApp.loadUiThemeDefs` so the editor preview matches what plays.
 * Returns null when the reference cannot be resolved (preview falls back to the
 * built-in CSS variables).
 */
export async function loadUiThemeAsset(ref: string): Promise<UiThemeDef | null> {
  try {
    const path = await resolveThemePath(ref);
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return null;
    return normalizeUiThemeDef(await response.json(), ref);
  } catch {
    return null;
  }
}

/** Maps a theme ref to a public path via the asset manifest, else uses it as-is. */
async function resolveThemePath(ref: string): Promise<string> {
  try {
    const project = await loadActiveProject();
    const response = await fetch(projectFileUrl(project.manifest.editor.assetManifest), {
      cache: "no-cache",
    });
    if (response.ok) {
      const manifest = (await response.json()) as AssetManifest;
      const asset = manifest.assets.find((entry) => entry.id === ref);
      if (asset) return assetPath(asset);
    }
  } catch {
    // Manifest unavailable: treat the ref as a direct public-relative path.
  }
  return ref;
}

export async function saveUiWidgetAsset(
  path: string,
  ui: UiWidgetDef,
): Promise<{ path: string; changed: boolean }> {
  const response = await fetch("/__save-ui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, ui }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `UI save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}
