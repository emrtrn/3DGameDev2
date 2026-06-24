/**
 * UI Widget asset I/O for the editor (dev-only).
 *
 * Loads a `*.ui.json` from the project public root and saves it back through the
 * dev `/__save-ui` endpoint, which re-validates + normalizes the payload server
 * side (see `tools/saveValidator.ts#validateSaveUiPayload`). Mirrors
 * `materialStore.ts`.
 */
import { normalizeUiWidgetDef, type UiWidgetDef } from "@engine/ui/uiWidget";
import { projectFileUrl } from "@/project/ProjectSystem";

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
