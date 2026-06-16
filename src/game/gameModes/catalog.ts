/**
 * Lightweight Game Mode catalog: id + display metadata only, no Three.js or
 * session code. The editor's World Settings dropdown and the save/runtime
 * fallback import this so they never pull the heavy runtime session classes
 * (`registry.ts`) into the editor bundle.
 *
 * This is project/game content, not engine or editor core — it lives under
 * `src/game` so the editor stays generic and only references it as data.
 */

export interface GameModeOption {
  /** Stable id stored in `worldSettings.gameMode`. */
  readonly id: string;
  /** Human-facing label shown in the editor dropdown. */
  readonly displayName: string;
  /** One-line summary of what the mode does. */
  readonly description: string;
}

/** Built-in Game Mode used when a layout selects none / an unknown id. */
export const DEFAULT_GAME_MODE_ID = "forge.defaultCamera";

/**
 * The selectable Game Modes, in dropdown order. The first entry is the default
 * camera mode and must keep `DEFAULT_GAME_MODE_ID`.
 */
export const GAME_MODE_OPTIONS: readonly GameModeOption[] = [
  {
    id: DEFAULT_GAME_MODE_ID,
    displayName: "Default Camera",
    description: "Runtime-only WASD camera pawn. No character is possessed.",
  },
  {
    id: "forge.tpsCharacter",
    displayName: "TPS Character",
    description: "Possesses an input-driven character with a third-person follow camera.",
  },
];

/** True when `id` names one of the built-in Game Modes. */
export function isKnownGameModeId(id: string | undefined): boolean {
  return id !== undefined && GAME_MODE_OPTIONS.some((option) => option.id === id);
}

/**
 * Resolves an authored (possibly unknown / undefined) Game Mode id to a known
 * id, falling back to {@link DEFAULT_GAME_MODE_ID}. Old layouts with no
 * `worldSettings.gameMode` therefore boot as the default camera mode.
 */
export function normalizeGameModeId(id: string | undefined): string {
  return isKnownGameModeId(id) ? (id as string) : DEFAULT_GAME_MODE_ID;
}
