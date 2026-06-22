/**
 * `forge.defaultCamera` — the built-in default Game Mode.
 *
 * Spawns a runtime-only camera pawn (the live camera itself; no scene object,
 * nothing written to the layout) and drives it with WASD. It never possesses a
 * character, even when the scene contains an `input-move` one — that auto-possess
 * rule belongs only to the explicitly selected TPS mode. Physics, audio and
 * behavior subsystems keep running; this session only owns the camera.
 *
 * Controls match the editor viewport's feel: WASD pans along the camera's facing
 * and a held right-mouse drag turns the view (yaw/pitch). The camera keeps
 * whatever pose it boots with — the scene's default framing, or the editor
 * camera pose handed off through the Play button — instead of being reframed.
 */
import { Vector3 } from "three";
import { DEFAULT_GAME_MODE_ID } from "./catalog";
import {
  applyConfiguredMouseLook,
  cameraPlanarPan,
  forwardFromLookAngles,
  lookAnglesFromForward,
  type LookAngles,
} from "./cameraControl";
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
  private look: LookAngles = { yaw: 0, pitch: 0 };

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
    const controller = defaultCameraGameMode.playerController;
    this.context.setInputMode(controller.inputMode ?? "game");
    this.context.setMouseCursorVisible(controller.mouseCursor !== "hide");
    this.context.setPointerLookMode(controller.pointerLookMode ?? "right-drag");
    // Own the camera so window resizes stop re-framing it from under the player.
    this.context.markCameraControlled();
    // Seed look angles from whatever pose the camera booted with so the first
    // right-drag continues smoothly instead of snapping.
    this.context.camera.getWorldDirection(this.forward);
    this.look = lookAnglesFromForward(this.forward.x, this.forward.y, this.forward.z);
  }

  update(deltaSeconds: number): void {
    this.gameState.elapsedSeconds += deltaSeconds;
    if (this.context.getInputMode() === "ui") return;
    const { camera, actions } = this.context;

    // Right-drag look: turn the accumulated pointer delta into yaw/pitch and aim
    // the camera before moving, so WASD follows the new facing.
    const { dx: lookDx, dy: lookDy } = this.context.consumeLookDelta();
    if (lookDx !== 0 || lookDy !== 0) {
      this.look = applyConfiguredMouseLook(
        this.look,
        lookDx,
        lookDy,
        {
          sensitivity: defaultCameraGameMode.playerController.lookSensitivity,
          invertY: defaultCameraGameMode.playerController.invertLookY,
        },
      );
      const dir = forwardFromLookAngles(this.look);
      camera.up.set(0, 1, 0);
      camera.lookAt(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z);
    }

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
    inputMode: "game",
    pointerLookMode: "right-drag",
    mouseCursor: "show",
    lookSensitivity: 0.003,
    invertLookY: false,
    possess: "camera-pawn",
  },
  createSession: (context) => new CameraPawnSession(context, defaultCameraGameMode.defaultPawn),
};
