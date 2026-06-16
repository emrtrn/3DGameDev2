/**
 * Pure, headless-testable mapping from a player's movement state to an animation
 * clip. No Three.js or DOM: the runtime shell feeds it the per-frame locomotion
 * snapshot the player behavior reports (src/game/behaviors.ts) plus the clip
 * names the character asset actually carries, and it returns the clip to play.
 *
 * Two layers keep both ends testable and asset-agnostic:
 *   1. `classifyLocomotion` -> a semantic state (idle/walk/run/jump/fall) from
 *      the kinematics, with tunable speed thresholds.
 *   2. `resolveLocomotionClip` -> a concrete clip name via per-state fallback
 *      chains, so an asset missing (say) a jump clip degrades to idle instead of
 *      snapping to a T-pose.
 */

/** Per-frame movement snapshot the player behavior reports to the shell. */
export interface LocomotionInput {
  /** Intended planar speed this tick (units/s), before collision clamping. */
  readonly planarSpeed: number;
  /** Whether the entity is resting on the floor (from the G2 vertical state). */
  readonly grounded: boolean;
  /** Vertical velocity (units/s); positive is up. */
  readonly velocityY: number;
}

/** Semantic locomotion state, independent of which clips an asset ships. */
export type LocomotionState = "idle" | "walk" | "run" | "jump" | "fall";

/** Planar-speed boundaries between the grounded states. */
export interface LocomotionThresholds {
  /** Above this planar speed the entity is at least walking. */
  readonly walkSpeed: number;
  /** At or above this planar speed the entity is running. */
  readonly runSpeed: number;
}

/**
 * Defaults tuned for the demo character: base walk speed ~2 and a sprint of ~4
 * (see `input-move`'s `sprintMultiplier`), so the run boundary sits between them.
 */
export const DEFAULT_LOCOMOTION_THRESHOLDS: LocomotionThresholds = {
  walkSpeed: 0.1,
  runSpeed: 3,
};

/**
 * Classifies the movement snapshot into a semantic state. Airborne (not
 * grounded) takes priority: rising reads as `jump`, descending as `fall`.
 * Grounded states fall out of the planar speed against the thresholds.
 */
export function classifyLocomotion(
  input: LocomotionInput,
  thresholds: LocomotionThresholds = DEFAULT_LOCOMOTION_THRESHOLDS,
): LocomotionState {
  if (!input.grounded) return input.velocityY > 0 ? "jump" : "fall";
  if (input.planarSpeed >= thresholds.runSpeed) return "run";
  if (input.planarSpeed > thresholds.walkSpeed) return "walk";
  return "idle";
}

/**
 * Per-state preference order of clip names. The first name present in the
 * asset's clip set wins, so a richer asset uses its dedicated clip and a sparser
 * one degrades gracefully (a missing run -> walk, a missing jump/fall -> idle).
 * Names follow the demo character's Kenney clip vocabulary.
 */
const CLIP_FALLBACKS: Record<LocomotionState, readonly string[]> = {
  idle: ["idle", "static"],
  walk: ["walk", "idle", "static"],
  run: ["sprint", "run", "walk", "idle", "static"],
  jump: ["jump", "jump-up", "idle", "static"],
  fall: ["fall", "jump-down", "jump", "idle", "static"],
};

/**
 * Resolves a semantic state to a concrete clip name present in `available`,
 * walking the state's fallback chain. As a last resort returns any available
 * clip; returns null only when the asset has no clips at all.
 */
export function resolveLocomotionClip(
  state: LocomotionState,
  available: ReadonlySet<string>,
): string | null {
  for (const name of CLIP_FALLBACKS[state]) {
    if (available.has(name)) return name;
  }
  for (const name of available) return name;
  return null;
}

/** Convenience: classify the snapshot then resolve it to an available clip. */
export function selectLocomotionClip(
  input: LocomotionInput,
  available: ReadonlySet<string>,
  thresholds?: LocomotionThresholds,
): string | null {
  return resolveLocomotionClip(classifyLocomotion(input, thresholds), available);
}
