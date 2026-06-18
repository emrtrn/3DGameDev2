/**
 * Pure interaction-trigger core (§3 Interaction runtime). Decides whether an
 * interaction fires this tick from overlap + enabled + cooldown, with edge
 * semantics (fires when the player first enters the sensor, not every tick) and
 * a per-trigger cooldown so it can re-fire after `cooldown` seconds. Headless
 * and deterministic; the `interact` behavior (src/game/behaviors.ts) drives it
 * from physics sensor contacts and the authored InteractionComponent, reusing
 * the goal-reached sensor pattern.
 */

export interface InteractionTriggerState {
  /** Was the trigger overlapping the player on the previous tick? */
  readonly wasOverlapping: boolean;
  /** Seconds left before the trigger may fire again (0 = ready). */
  readonly cooldownRemaining: number;
}

export interface InteractionStepInput {
  /** Is the player overlapping the trigger this tick? */
  readonly overlapping: boolean;
  /** Whether the interaction is currently enabled. */
  readonly enabled: boolean;
  /** Cooldown (seconds) armed after a fire; <= 0 fires on every fresh enter. */
  readonly cooldown: number;
  /** Seconds elapsed this tick. */
  readonly dt: number;
}

export interface InteractionStepResult {
  /** Did the interaction fire on this tick? */
  readonly fire: boolean;
  /** The next trigger state to carry into the following tick. */
  readonly state: InteractionTriggerState;
}

/** Fresh trigger state: not overlapping, ready to fire. */
export function initialInteractionState(): InteractionTriggerState {
  return { wasOverlapping: false, cooldownRemaining: 0 };
}

/**
 * Advances one interaction trigger. Fires only on a fresh enter
 * (`overlapping && !wasOverlapping`) while enabled and off cooldown; a fire
 * arms the cooldown. The cooldown always decays by `dt`, and `wasOverlapping`
 * always tracks the current overlap — so a held overlap never re-fires, and
 * enabling mid-overlap waits for a genuine re-enter.
 */
export function stepInteractionTrigger(
  prev: InteractionTriggerState,
  input: InteractionStepInput,
): InteractionStepResult {
  const cooldownRemaining = Math.max(0, prev.cooldownRemaining - Math.max(0, input.dt));
  const freshEnter = input.overlapping && !prev.wasOverlapping;
  const fire = input.enabled && freshEnter && cooldownRemaining <= 0;
  return {
    fire,
    state: {
      wasOverlapping: input.overlapping,
      cooldownRemaining: fire ? Math.max(0, input.cooldown) : cooldownRemaining,
    },
  };
}
