/**
 * `forge.tpsCharacter` — the explicit third-person Game Mode.
 *
 * Possesses one player character and drives a behind-and-above follow camera plus
 * the crossfade locomotion animator (the gameplay that previously lived hardcoded
 * in `RuntimeSceneApp`). The player is chosen explicitly: a character tagged with
 * metadata `player: true` wins, otherwise the first character carrying the
 * `input-move` behavior. Because this only runs when the user selects TPS in
 * World Settings, an `input-move` character is never auto-played by the default
 * camera mode — `input-move` stays a general behavior, not a "player" marker.
 */
import { CrossfadeAnimator } from "@engine/render-three/characterAnimator";
import {
  readCameraComponent,
  readSpringArmComponent,
  type CameraComponent,
  type SpringArmComponent,
} from "@engine/scene/components";
import {
  smoothingFactor,
  stepFollowCamera,
  type FollowCameraConfig,
  type FollowCameraPose,
  type Vec3,
} from "@/game/followCamera";
import {
  selectLocomotionClip,
  DEFAULT_LOCOMOTION_THRESHOLDS,
} from "@/game/locomotionAnimation";
import {
  cameraProjectionFromComponent,
  desiredSpringArmCameraPose,
  stepSpringArmCameraPose,
} from "@/game/springArmCamera";
import {
  applyConfiguredMouseLook,
  DEFAULT_LOOK_AXIS_RATE,
  lookAnglesFromForward,
  type LookAngles,
} from "./cameraControl";
import type {
  GameModeContext,
  GameModeDefinition,
  GameModeSession,
  GameState,
  PlayerState,
  RuntimeCharacterRef,
} from "./types";

/**
 * Third-person follow camera: sits behind (+z) and above the player, looking
 * down -z so the world movement frame reads as camera-relative. `RATE` is the
 * exponential easing speed (per second) the camera uses to track the player.
 */
const FOLLOW_CAMERA_CONFIG: FollowCameraConfig = {
  offset: [0, 1.2, 2.6],
  lookHeight: 0.5,
};
const FOLLOW_CAMERA_RATE = 8;
const INITIAL_CONTROL_ROTATION = lookAnglesFromForward(
  -FOLLOW_CAMERA_CONFIG.offset[0],
  FOLLOW_CAMERA_CONFIG.lookHeight - FOLLOW_CAMERA_CONFIG.offset[1],
  -FOLLOW_CAMERA_CONFIG.offset[2],
);
const RAD_TO_DEG = 180 / Math.PI;

/** Crossfade duration (seconds) between locomotion clips. */
const ANIMATION_CROSSFADE_SECONDS = 0.18;

/** Resolves the explicit player character a TPS session should possess. */
export function resolvePlayerCharacter(
  characters: readonly RuntimeCharacterRef[],
): RuntimeCharacterRef | undefined {
  const tagged = characters.find((ref) => ref.placement.metadata?.player === true);
  if (tagged) return tagged;
  const actorCharacter = characters.find((ref) => ref.hasCharacterMovement);
  if (actorCharacter) return actorCharacter;
  return characters.find((ref) => ref.placement.behavior?.script === "input-move");
}

/**
 * The third-person session: follow camera + locomotion crossfade over the
 * resolved player character. Exported so project Game Modes
 * (`projectGameMode.ts`) reuse the exact possession/camera behavior, differing
 * only in which default pawn the runtime spawns.
 */
export class TpsCharacterSession implements GameModeSession {
  readonly playerState: PlayerState = { pawnEntityId: null, possessed: false };
  readonly gameState: GameState = { elapsedSeconds: 0 };
  private player: RuntimeCharacterRef | null = null;
  private animator: CrossfadeAnimator | null = null;
  private followPose: FollowCameraPose | null = null;
  private controlRotation: LookAngles = INITIAL_CONTROL_ROTATION;
  private activeCameraSource: "follow config" | "spring arm component" = "follow config";

  constructor(private readonly context: GameModeContext) {}

  spawnDefaultPawn(): void {
    this.player = resolvePlayerCharacter(this.context.characters) ?? null;
    this.playerState.pawnEntityId = this.player?.entityId ?? null;
  }

  possess(): void {
    const player = this.player;
    if (!player) return;
    this.playerState.possessed = true;
    const controller = tpsCharacterGameMode.playerController;
    this.context.setInputMode(controller.inputMode ?? "game");
    this.context.setMouseCursorVisible(controller.mouseCursor !== "hide");
    this.context.setPointerLookMode(controller.pointerLookMode ?? "pointer-lock");
    // The player gets the full clip set, crossfaded by movement state; snap to
    // the authored idle clip so it never flashes a bind pose.
    const animator = new CrossfadeAnimator(player.object, player.gltf.animations);
    animator.play(player.placement.animation ?? "idle", 0);
    this.context.addMixer(animator.mixer);
    this.animator = animator;
    // Following the player owns the view; stop the resize handler resetting it.
    this.context.markCameraControlled();
  }

  update(deltaSeconds: number): void {
    this.gameState.elapsedSeconds += deltaSeconds;
    const player = this.player;
    if (!player) return;
    this.updateFollowCamera(player, deltaSeconds);
    this.updateAnimation(player);
  }

  beforeEngineUpdate(deltaSeconds: number): void {
    if (this.context.getInputMode() === "ui") return;
    const delta = this.context.consumeLookDelta();
    const axisRate =
      tpsCharacterGameMode.playerController.lookAxisRate ?? DEFAULT_LOOK_AXIS_RATE;
    const axisDt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
    const axisDx = this.context.actions.axis("look-x") * axisRate * axisDt;
    const axisDy = this.context.actions.axis("look-y") * axisRate * axisDt;
    const dx = delta.dx + axisDx;
    const dy = delta.dy + axisDy;
    if (dx === 0 && dy === 0) return;
    this.controlRotation = applyConfiguredMouseLook(
      this.controlRotation,
      dx,
      dy,
      {
        sensitivity: tpsCharacterGameMode.playerController.lookSensitivity,
        invertY: tpsCharacterGameMode.playerController.invertLookY,
      },
    );
  }

  controlYawForEntity(entityId: string): number | null {
    return this.player?.entityId === entityId ? this.controlRotation.yaw : null;
  }

  getCameraDebug(): {
    readonly controlYawDeg: number | null;
    readonly controlPitchDeg: number | null;
    readonly cameraSource: string | null;
  } {
    return {
      controlYawDeg: this.controlRotation.yaw * RAD_TO_DEG,
      controlPitchDeg: this.controlRotation.pitch * RAD_TO_DEG,
      cameraSource: this.activeCameraSource,
    };
  }

  dispose(): void {
    this.context.setInputMode("ui");
    this.context.setMouseCursorVisible(true);
    this.context.setPointerLookMode("right-drag");
    // The animator's mixer is owned by the AnimationSubsystem (disposed by the
    // EngineApp); nothing extra to release here.
  }

  private updateFollowCamera(player: RuntimeCharacterRef, deltaSeconds: number): void {
    const pos: Vec3 = [player.object.position.x, player.object.position.y, player.object.position.z];
    const authored = this.authoredCamera(player);
    if (authored.springArm) {
      this.activeCameraSource = "spring arm component";
      this.syncProjection(authored.camera);
      const desired = desiredSpringArmCameraPose({
        playerPosition: pos,
        springArm: authored.springArm,
        controlRotation: this.controlRotation,
        blockers: this.context.staticBlockerAabbs(),
      });
      const t = authored.springArm.enableCameraLag
        ? smoothingFactor(authored.springArm.cameraLagSpeed, deltaSeconds)
        : 1;
      this.followPose = stepSpringArmCameraPose(this.followPose, desired, t);
    } else {
      this.activeCameraSource = "follow config";
      const t = smoothingFactor(FOLLOW_CAMERA_RATE, deltaSeconds);
      this.followPose = stepFollowCamera(this.followPose, pos, FOLLOW_CAMERA_CONFIG, t);
    }
    const { position, target } = this.followPose;
    this.context.camera.position.set(position[0], position[1], position[2]);
    this.context.camera.lookAt(target[0], target[1], target[2]);
  }

  private updateAnimation(player: RuntimeCharacterRef): void {
    const animator = this.animator;
    if (!animator) return;
    const report = this.context.getLocomotion(player.entityId);
    if (!report) return;
    const clip = selectLocomotionClip(report, animator.clips, DEFAULT_LOCOMOTION_THRESHOLDS);
    if (clip) animator.play(clip, ANIMATION_CROSSFADE_SECONDS);
  }

  private authoredCamera(player: RuntimeCharacterRef): {
    readonly springArm: SpringArmComponent | undefined;
    readonly camera: CameraComponent | undefined;
  } {
    const entity = player.entity;
    if (!entity) return { springArm: undefined, camera: undefined };
    return {
      springArm: readSpringArmComponent(entity),
      camera: readCameraComponent(entity),
    };
  }

  private syncProjection(camera: CameraComponent | undefined): void {
    if (!camera) return;
    const projection = cameraProjectionFromComponent(camera);
    const live = this.context.camera;
    if (
      live.fov === projection.fov &&
      live.near === projection.near &&
      live.far === projection.far
    ) {
      return;
    }
    live.fov = projection.fov;
    live.near = projection.near;
    live.far = projection.far;
    live.updateProjectionMatrix();
  }
}

export const tpsCharacterGameMode: GameModeDefinition = {
  id: "forge.tpsCharacter",
  displayName: "TPS Character",
  description: "Possesses an input-driven character with a third-person follow camera.",
  defaultPawn: {
    id: "forge.tpsPawn",
    kind: "character",
    // Temporary default: when the scene has no authored player, TPS spawns this
    // character at the Player Start. Tuned to match the follow camera (the demo
    // Blocky Character reads correctly at 0.3).
    characterAssetId: "character-a",
    characterScale: 0.3,
    movement: { speed: 3, sprintMultiplier: 2 },
  },
  playerController: {
    id: "forge.tpsController",
    inputActions: [
      "move-forward",
      "move-back",
      "move-left",
      "move-right",
      "jump",
      "sprint",
      "look-x",
      "look-y",
    ],
    inputMode: "game",
    pointerLookMode: "pointer-lock",
    mouseCursor: "hide",
    lookSensitivity: 0.003,
    lookAxisRate: DEFAULT_LOOK_AXIS_RATE,
    invertLookY: false,
    possess: "first-input-move-character",
  },
  createSession: (context) => new TpsCharacterSession(context),
};
