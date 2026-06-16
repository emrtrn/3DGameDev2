/**
 * Gameplay framework contracts (Unreal-inspired). A Game Mode owns the rules for
 * a Play session: which pawn spawns, which controller possesses it, and how the
 * camera/animation update each tick. The runtime shell
 * (`src/scene/RuntimeSceneApp.ts`) builds the scene, then hands the selected
 * mode a {@link GameModeContext} and drives the returned {@link GameModeSession}.
 *
 * Editor code is never imported here, and a session never writes runtime state
 * back into the saved layout.
 */
import type { AnimationMixer, Object3D, PerspectiveCamera } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ActionMap } from "@engine/input/actionMap";
import type { LayoutCharacter } from "@engine/scene/layout";
import type { LocomotionInput } from "@/game/locomotionAnimation";

export type Vec3 = [number, number, number];

/**
 * The pawn a Game Mode spawns/possesses. `camera` is a runtime-only flythrough
 * pawn (no scene object — the camera itself is the pawn); `character` possesses
 * an existing layout character.
 */
export interface PawnDefinition {
  readonly id: string;
  readonly kind: "camera" | "character";
  /** Movement tuning (units/s, sprint multiplier). Optional per kind. */
  readonly movement?: {
    readonly speed?: number;
    readonly sprintMultiplier?: number;
  };
}

/** How a Game Mode's controller selects and binds to its pawn. */
export interface PlayerControllerDefinition {
  readonly id: string;
  /** Named input actions this controller reads (informational contract). */
  readonly inputActions: readonly string[];
  /**
   * Possess target contract:
   * - `camera-pawn`: take over the runtime camera (no character possession).
   * - `first-input-move-character`: possess the explicitly resolved player
   *   character (metadata `player` tag, else first `input-move` behavior).
   */
  readonly possess: "camera-pawn" | "first-input-move-character";
}

/** A static Game Mode definition registered in the runtime registry. */
export interface GameModeDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly defaultPawn: PawnDefinition;
  readonly playerController: PlayerControllerDefinition;
  /** Builds a fresh session bound to one Play boot's scene/camera. */
  createSession(context: GameModeContext): GameModeSession;
}

/**
 * Runtime-only player state surface (Unreal's PlayerState analogue). Never
 * serialized to the layout.
 */
export interface PlayerState {
  /** Entity id of the possessed pawn, or null when nothing is possessed. */
  pawnEntityId: string | null;
  /** True once the controller has possessed its pawn. */
  possessed: boolean;
}

/**
 * Runtime-only game/session state surface (Unreal's GameState analogue). Never
 * serialized to the layout.
 */
export interface GameState {
  elapsedSeconds: number;
}

/** A character the runtime built from the layout, offered to the Game Mode. */
export interface RuntimeCharacterRef {
  readonly index: number;
  readonly entityId: string;
  readonly object: Object3D;
  readonly gltf: GLTF;
  readonly placement: LayoutCharacter;
}

/**
 * What the runtime shell exposes to a Game Mode session: the live camera, input,
 * the built characters, and small bridges back into the runtime (animation
 * mixer registration, locomotion snapshots, camera ownership).
 */
export interface GameModeContext {
  readonly camera: PerspectiveCamera;
  readonly actions: ActionMap;
  readonly characters: readonly RuntimeCharacterRef[];
  /** Latest locomotion snapshot a behavior reported for `entityId` this tick. */
  getLocomotion(entityId: string): LocomotionInput | undefined;
  /** Registers a crossfade animator's mixer with the animation subsystem. */
  addMixer(mixer: AnimationMixer): void;
  /**
   * Marks the runtime camera as controlled by this session so the responsive
   * resize handler stops re-framing it.
   */
  markCameraControlled(): void;
}

/**
 * A live Game Mode session. Lifecycle: {@link spawnDefaultPawn} →
 * {@link possess} once at boot, {@link update} each tick, {@link dispose} on
 * teardown. State surfaces are read-only views the shell may inspect.
 */
export interface GameModeSession {
  readonly playerState: PlayerState;
  readonly gameState: GameState;
  /** Resolve/spawn the default pawn (sets `playerState.pawnEntityId`). */
  spawnDefaultPawn(): void;
  /** Bind the controller to the spawned pawn (camera/animation wiring). */
  possess(): void;
  /** Advance the session one tick (after the engine has updated). */
  update(deltaSeconds: number): void;
  /** Release any session-owned resources. */
  dispose(): void;
}
