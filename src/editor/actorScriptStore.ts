/**
 * Editor-side load/save for Actor Script class-assets (`*.actor.json`).
 *
 * Reads are plain static fetches of `public/` (so a missing/malformed file still
 * resolves to a usable class via {@link normalizeActorScriptDef}); writes go
 * through the dev-only `/__save-actor` endpoint (see vite.config.ts).
 */
import { normalizeActorScriptDef, type ActorScriptDef } from "@engine/scene/actorScript";
import { projectFileUrl } from "@/project/ProjectSystem";

/** Fetches and normalizes an Actor Script; never throws on a bad/missing file. */
export async function loadActorScript(
  path: string,
  fallbackName = "Untitled",
): Promise<ActorScriptDef> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return normalizeActorScriptDef({ name: fallbackName }, fallbackName);
    const raw = (await response.json()) as unknown;
    return normalizeActorScriptDef(raw, fallbackName);
  } catch {
    return normalizeActorScriptDef({ name: fallbackName }, fallbackName);
  }
}

/** Posts an Actor Script definition to the dev save endpoint. */
export async function saveActorScript(
  path: string,
  def: ActorScriptDef,
): Promise<{ path: string; changed: boolean }> {
  const response = await fetch("/__save-actor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, actor: def }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Actor save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}
