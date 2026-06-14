import type { Subsystem } from "@engine/core/Subsystem";
import type { ActionMap } from "./actionMap";

/** Stable registry id for the input subsystem. */
export const INPUT_SUBSYSTEM_ID = "input.action-map";

/**
 * Advances an {@link ActionMap} once per engine tick, turning the raw
 * down/up codes fed in by a DOM source into this tick's pressed/held/released
 * action edges. DOM-free: the raw events arrive via the action map, not here.
 *
 * Register this before any behavior subsystem so behaviors read current-tick
 * action state.
 */
export class InputSubsystem implements Subsystem {
  readonly id = INPUT_SUBSYSTEM_ID;

  constructor(private readonly actions: ActionMap) {}

  update(): void {
    this.actions.advance();
  }
}
