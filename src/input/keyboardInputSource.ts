import type { ActionMap } from "@engine/input/actionMap";

/**
 * Browser keyboard -> {@link ActionMap} bridge (runtime DOM layer).
 *
 * Observer only: it records raw key down/up codes into the action map and never
 * calls `preventDefault`, so it does not interfere with editor shortcuts or
 * camera navigation. Works in both game and editor mode.
 *
 * The action map is DOM-free; this is the only piece that touches `window`.
 */
export class KeyboardInputSource {
  constructor(
    private readonly actions: ActionMap,
    private readonly target: Window = window,
  ) {}

  attach(): void {
    this.target.addEventListener("keydown", this.handleKeyDown);
    this.target.addEventListener("keyup", this.handleKeyUp);
    this.target.addEventListener("blur", this.handleBlur);
  }

  detach(): void {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("blur", this.handleBlur);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    // Auto-repeat keeps the code in the down set already; ignore repeats so a
    // held key does not re-fire as a fresh press.
    if (event.repeat) return;
    this.actions.handleDown(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.actions.handleUp(event.code);
  };

  private handleBlur = (): void => {
    // Releasing focus drops physical key state so held keys do not stick.
    this.actions.reset();
  };
}
