/**
 * Editor-side helper for the Actor Script editor's "New Behavior" action.
 *
 * Posts an event-binding `scriptId` to the dev-only `/__new-behavior` endpoint,
 * which scaffolds a TypeScript behavior stub at `src/game/scripts/<slug>.ts` (see
 * vite.config.ts). The class data itself stays in the `*.actor.json`; this only
 * generates the source signature for AI/devs to implement + register.
 */

export interface NewBehaviorResult {
  /** Project-relative path of the created stub (`src/game/scripts/<slug>.ts`). */
  path: string;
  /** The camelCase export the stub declares. */
  exportName: string;
  /** True when the file already existed (server returned 409); no overwrite. */
  alreadyExists: boolean;
}

/** Requests a behavior stub for `scriptId`; throws with the server error on failure. */
export async function createBehaviorStub(scriptId: string): Promise<NewBehaviorResult> {
  const response = await fetch("/__new-behavior", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scriptId }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    exportName?: string;
  };
  // 409 = the stub already exists: surface it as a soft result, not a throw, so
  // the user can keep editing against the existing file.
  if (response.status === 409) {
    return { path: body.path ?? "", exportName: "", alreadyExists: true };
  }
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `New behavior failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? "", exportName: body.exportName ?? "", alreadyExists: false };
}
