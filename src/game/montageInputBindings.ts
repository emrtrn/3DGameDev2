/**
 * Code-owned map of input actions to the upper-body montages they play, plus the
 * pure resolver that turns a character's authored montages into input bindings.
 *
 * Binding a key to a montage is a Character/code responsibility, not asset data:
 * a shared skeletal mesh handed to an NPC must not carry "emote → Q" intent. The
 * `*.skeleton.json` sidecar only *defines* a montage (clip/slot/blend); which
 * input fires it lives here — mirroring Unreal, where the Character Blueprint
 * calls `PlayAnimMontage` on input, not the skeletal mesh asset.
 *
 * Action names (e.g. "fire", "aim", "emote") resolve to physical keys via the
 * runtime `ActionMap` (`DEFAULT_INPUT_BINDINGS`), so this map stays free of
 * device-specific key codes. The agent adds a row here per montage as the user
 * requests ("bind reload to R"). Kept dependency-light (types only) so editor
 * read-only views can reuse the resolver without the TPS runtime.
 */
import type { AssetSkeletonMontageDef } from "@/scene/assetSkeletonLoader";

/** press = one-shot on key-down; hold = layer the pose while the key is held. */
export const MONTAGE_TRIGGER_MODES = ["press", "hold"] as const;
export type MontageTriggerMode = (typeof MONTAGE_TRIGGER_MODES)[number];

/**
 * One input → montage binding, resolved against a character's authored montages
 * by name at possession time.
 */
export interface MontageInputBinding {
  /** Named input action (mapped to a key by `DEFAULT_INPUT_BINDINGS`). */
  readonly action: string;
  /** Montage name as authored on the character's `*.skeleton.json`. */
  readonly montage: string;
  /** How the action drives the montage. */
  readonly mode: MontageTriggerMode;
}

/**
 * The active bindings. Empty by default: the demo character's "aim"/"fire"
 * upper-body montages bind through the backward-compatible name convention in
 * `resolveMontageBindings`. Add rows here to bind other montages to input
 * (the code map wins over the convention on a name conflict).
 */
export const MONTAGE_INPUT_BINDINGS: readonly MontageInputBinding[] = [];

/** An authored upper-body montage resolved to the input action + mode that fires it. */
export interface MontageBinding {
  /** Name of the montage on the character's skeleton sidecar. */
  readonly montage: string;
  /** Clip the montage plays. */
  readonly clip: string;
  /** Named input action that triggers it. */
  readonly action: string;
  /** "press" = one-shot, "hold" = layered while held. */
  readonly mode: MontageTriggerMode;
  readonly blendInSeconds: number;
  readonly blendOutSeconds: number;
}

/**
 * Resolves authored upper-body montages to input bindings. The code-owned
 * `codeMap` binds input actions to montages by name; the TPS naming convention
 * (a montage named "aim" holds, one named "fire" presses) supplies backward-
 * compatible defaults, and the code map wins on a name conflict. Montages with
 * neither are skipped (game code triggers them, not input). Pure and ordered by
 * the authored montage list.
 */
export function resolveMontageBindings(
  montages: readonly AssetSkeletonMontageDef[] | undefined,
  codeMap: readonly MontageInputBinding[] = MONTAGE_INPUT_BINDINGS,
): MontageBinding[] {
  const byMontage = new Map<string, { action: string; mode: MontageTriggerMode }>();
  // Backward-compatible name convention (lowest priority).
  for (const montage of montages ?? []) {
    const convention = conventionTriggerForName(montage.name);
    if (convention) byMontage.set(montage.name, convention);
  }
  // Code-owned bindings override the convention for the named montage.
  for (const binding of codeMap) {
    byMontage.set(binding.montage, { action: binding.action, mode: binding.mode });
  }
  const bindings: MontageBinding[] = [];
  for (const montage of montages ?? []) {
    if (montage.slot !== "upperBody") continue;
    const trigger = byMontage.get(montage.name);
    if (!trigger) continue;
    bindings.push({
      montage: montage.name,
      clip: montage.clip,
      action: trigger.action,
      mode: trigger.mode,
      blendInSeconds: montage.blendInSeconds,
      blendOutSeconds: montage.blendOutSeconds,
    });
  }
  return bindings;
}

function conventionTriggerForName(
  name: string,
): { action: string; mode: MontageTriggerMode } | null {
  if (name === "aim") return { action: "aim", mode: "hold" };
  if (name === "fire") return { action: "fire", mode: "press" };
  return null;
}
