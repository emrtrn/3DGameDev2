/**
 * `forge.defaultCamera` — the built-in default Game Mode.
 *
 * Spawns a runtime-only camera pawn (the live camera itself; no scene object,
 * nothing written to the layout) and drives it with WASD. It never possesses a
 * character, even when the scene contains an `input-move` one — that auto-possess
 * rule belongs only to the explicitly selected TPS mode. Physics, audio and
 * behavior subsystems keep running; this session only owns the camera.
 *
 * Look/orbit control is intentionally out of scope for this iteration: WASD pans
 * the camera horizontally along its current facing and the orientation set by
 * the scene's default framing is preserved (an RTS-style pan).
 */
import { Vector3 } from "three";
import { DEFAULT_GAME_MODE_ID } from "./catalog";
import { cameraPlanarPan } from "./cameraControl";
import type {
  GameModeContext,
  GameModeDefinition,
  GameModeSession,
  GameState,
  PawnDefinition,
  PlayerState,
} from "./types";

/** Default flythrough speed (units/s) when the pawn declares none. */
const DEFAULT_CAMERA_SPEED = 6;

class CameraPawnSession implements GameModeSession {
  readonly playerState: PlayerState = { pawnEntityId: null, possessed: false };
  readonly gameState: GameState = { elapsedSeconds: 0 };
  private readonly speed: number;
  private readonly forward = new Vector3();

  constructor(
    private readonly context: GameModeContext,
    pawn: PawnDefinition,
  ) {
    this.speed = pawn.movement?.speed ?? DEFAULT_CAMERA_SPEED;
  }

  spawnDefaultPawn(): void {
    // The camera pawn has no scene object: the live camera, already framed by
    // the responsive viewport, is the pawn. Nothing to spawn or write back.
  }

  possess(): void {
    this.playerState.possessed = true;
    // Own the camera so window resizes stop re-framing it from under the player.
    this.context.markCameraControlled();
  }

  update(deltaSeconds: number): void {
    this.gameState.elapsedSeconds += deltaSeconds;
    const { camera, actions } = this.context;
    camera.getWorldDirection(this.forward);
    const { dx, dz } = cameraPlanarPan(
      this.forward.x,
      this.forward.z,
      {
        forward: actions.held("move-forward"),
        back: actions.held("move-back"),
        left: actions.held("move-left"),
        right: actions.held("move-right"),
      },
      this.speed,
      deltaSeconds,
    );
    camera.position.x += dx;
    camera.position.z += dz;
  }

  dispose(): void {
    // No session-owned resources to release.
  }
}

export const defaultCameraGameMode: GameModeDefinition = {
  id: DEFAULT_GAME_MODE_ID,
  displayName: "Default Camera",
  description: "Runtime-only WASD camera pawn. No character is possessed.",
  defaultPawn: {
    id: "forge.cameraPawn",
    kind: "camera",
    movement: { speed: DEFAULT_CAMERA_SPEED },
  },
  playerController: {
    id: "forge.cameraController",
    inputActions: ["move-forward", "move-back", "move-left", "move-right"],
    possess: "camera-pawn",
  },
  createSession: (context) => new CameraPawnSession(context, defaultCameraGameMode.defaultPawn),
};
