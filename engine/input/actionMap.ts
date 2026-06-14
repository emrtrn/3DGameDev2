/**
 * Pure, DOM-free input action map.
 *
 * Maps raw input codes (keyboard `event.code` strings, or synthetic
 * pointer/button codes) to named, game-meaningful actions, and derives per-tick
 * pressed/held/released edges from the set of codes currently down.
 *
 * No DOM, no `engine/core`, no render imports: a DOM source feeds raw codes in
 * (see the runtime `KeyboardInputSource`) and the `InputSubsystem` calls
 * `advance()` once per engine tick. Behaviors then read action state.
 */

/** A raw input code (keyboard `event.code`, or a synthetic pointer/button id). */
export type RawInputCode = string;

/** A named, game-meaningful action (e.g. "move-forward", "jump"). */
export type ActionName = string;

/** Per-tick state for one action. */
export interface ActionState {
  /** True only on the tick the action transitioned from up to down. */
  readonly pressed: boolean;
  /** True for every tick the action is down (including the press tick). */
  readonly held: boolean;
  /** True only on the tick the action transitioned from down to up. */
  readonly released: boolean;
}

/** Raw-code -> action-name bindings. Many codes may map to one action. */
export type ActionBindings = Readonly<Record<RawInputCode, ActionName>>;

const IDLE: ActionState = { pressed: false, held: false, released: false };

export class ActionMap {
  private readonly bindings: Map<RawInputCode, ActionName>;
  private readonly downCodes = new Set<RawInputCode>();
  private heldActions = new Set<ActionName>();
  private states = new Map<ActionName, ActionState>();

  constructor(bindings: ActionBindings = {}) {
    this.bindings = new Map(Object.entries(bindings));
  }

  /** Binds a raw code to a named action, replacing any existing binding. */
  bind(code: RawInputCode, action: ActionName): void {
    this.bindings.set(code, action);
  }

  /** Records a raw code as physically down. Safe to call repeatedly. */
  handleDown(code: RawInputCode): void {
    this.downCodes.add(code);
  }

  /** Records a raw code as physically up. */
  handleUp(code: RawInputCode): void {
    this.downCodes.delete(code);
  }

  /** Clears all physical key state (e.g. on window blur / focus loss). */
  reset(): void {
    this.downCodes.clear();
  }

  /**
   * Recomputes per-tick action edges from the codes currently down versus the
   * actions held at the previous `advance()`. Call exactly once per engine tick
   * (the `InputSubsystem` does this) before behaviors read action state.
   */
  advance(): void {
    const currentHeld = new Set<ActionName>();
    for (const code of this.downCodes) {
      const action = this.bindings.get(code);
      if (action) currentHeld.add(action);
    }

    const states = new Map<ActionName, ActionState>();
    for (const action of new Set<ActionName>([...currentHeld, ...this.heldActions])) {
      const held = currentHeld.has(action);
      const wasHeld = this.heldActions.has(action);
      states.set(action, {
        pressed: held && !wasHeld,
        held,
        released: !held && wasHeld,
      });
    }

    this.states = states;
    this.heldActions = currentHeld;
  }

  /** Returns the current-tick state for an action (idle if untouched). */
  get(action: ActionName): ActionState {
    return this.states.get(action) ?? IDLE;
  }

  pressed(action: ActionName): boolean {
    return this.get(action).pressed;
  }

  held(action: ActionName): boolean {
    return this.get(action).held;
  }

  released(action: ActionName): boolean {
    return this.get(action).released;
  }
}
