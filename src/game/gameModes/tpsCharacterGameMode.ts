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
  classifyLocomotion,
  selectLocomotionClip,
  DEFAULT_LOCOMOTION_THRESHOLDS,
} from "@/game/locomotionAnimation";
import {
  cameraProjectionFromComponent,
  desiredSpringArmCameraPose,
  stepSpringArmCameraPose,
} from "@/game/springArmCamera";
import type { CameraProjection, CameraPose } from "@/game/playerCameraManager";
import { RuntimePlayerController } from "@/game/playerController";
import { DEFAULT_LOOK_AXIS_RATE, lookAnglesFromForward } from "./cameraControl";
import type {
  GameModeContext,
  GameModeDefinition,
  GameModeSession,
  GameState,
  PlayerControllerDefinition,
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
const CAMERA_SOURCE_BLEND_SECONDS = 0.25;
const SPRINT_FOV_OFFSET = 6;
const SPRINT_SHAKE_AMPLITUDE = 0.025;
const SPRINT_SHAKE_FREQUENCY_HZ = 8;

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
  readonly playerState: PlayerState;
  readonly gameState: GameState = { elapsedSeconds: 0 };
  private readonly controller: RuntimePlayerController;
  private player: RuntimeCharacterRef | null = null;
  private animator: CrossfadeAnimator | null = null;
  private followPose: FollowCameraPose | null = null;
  private activeCameraSource: "follow config" | "spring arm component" = "follow config";

  constructor(
    private readonly context: GameModeContext,
    controllerDefinition: PlayerControllerDefinition = TPS_PLAYER_CONTROLLER,
  ) {
    this.controller = new RuntimePlayerController(controllerDefinition, context, {
      initialControlRotation: INITIAL_CONTROL_ROTATION,
    });
    this.playerState = this.controller.playerState;
  }

  spawnDefaultPawn(): void {
    this.player = resolvePlayerCharacter(this.context.characters) ?? null;
    this.controller.setPawn(this.player?.entityId ?? null);
  }

  possess(): void {
    const player = this.player;
    if (!player) return;
    this.controller.possess(player.entityId);
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
    this.controller.updateControlRotation(deltaSeconds);
  }

  controlYawForEntity(entityId: string): number | null {
    return this.controller.controlYawForEntity(entityId);
  }

  getCameraDebug(): {
    readonly controlYawDeg: number | null;
    readonly controlPitchDeg: number | null;
    readonly cameraSource: string | null;
  } {
    const controlRotation = this.controller.getControlRotation();
    return {
      controlYawDeg: controlRotation.yaw * RAD_TO_DEG,
      controlPitchDeg: controlRotation.pitch * RAD_TO_DEG,
      cameraSource: this.controller.cameraManager.cameraSource ?? this.activeCameraSource,
    };
  }

  dispose(): void {
    this.controller.unpossess();
    // The animator's mixer is owned by the AnimationSubsystem (disposed by the
    // EngineApp); nothing extra to release here.
  }

  private updateFollowCamera(player: RuntimeCharacterRef, deltaSeconds: number): void {
    const pos: Vec3 = [player.object.position.x, player.object.position.y, player.object.position.z];
    const authored = this.authoredCamera(player);
    this.updateGameplayCameraEffects(player);
    if (authored.springArm) {
      this.activeCameraSource = "spring arm component";
      const desired = desiredSpringArmCameraPose({
        playerPosition: pos,
        springArm: authored.springArm,
        controlRotation: this.controller.getControlRotation(),
        blockers: this.context.staticBlockerAabbs(),
      });
      const t = authored.springArm.enableCameraLag
        ? smoothingFactor(authored.springArm.cameraLagSpeed, deltaSeconds)
        : 1;
      this.followPose = stepSpringArmCameraPose(this.followPose, desired, t);
      this.applyCameraView(
        this.activeCameraSource,
        this.followPose,
        this.cameraProjection(authored.camera),
        deltaSeconds,
      );
    } else {
      this.activeCameraSource = "follow config";
      const t = smoothingFactor(FOLLOW_CAMERA_RATE, deltaSeconds);
      this.followPose = stepFollowCamera(this.followPose, pos, FOLLOW_CAMERA_CONFIG, t);
      this.applyCameraView(
        this.activeCameraSource,
        this.followPose,
        this.cameraProjection(undefined),
        deltaSeconds,
      );
    }
  }

  private updateAnimation(player: RuntimeCharacterRef): void {
    const animator = this.animator;
    if (!animator) return;
    const report = this.context.getLocomotion(player.entityId);
    if (!report) return;
    const clip = selectLocomotionClip(report, animator.clips, DEFAULT_LOCOMOTION_THRESHOLDS);
    if (clip) animator.play(clip, ANIMATION_CROSSFADE_SECONDS);
  }

  private updateGameplayCameraEffects(player: RuntimeCharacterRef): void {
    const report = this.context.getLocomotion(player.entityId);
    const sprinting =
      report !== undefined &&
      classifyLocomotion(report, DEFAULT_LOCOMOTION_THRESHOLDS) === "run";
    this.controller.cameraManager.setGameplayEffects(
      sprinting
        ? {
            fovOffset: SPRINT_FOV_OFFSET,
            shakeAmplitude: SPRINT_SHAKE_AMPLITUDE,
            shakeFrequencyHz: SPRINT_SHAKE_FREQUENCY_HZ,
          }
        : {},
    );
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

  private applyCameraView(
    source: string,
    pose: CameraPose,
    projection: CameraProjection,
    deltaSeconds: number,
  ): void {
    this.controller.cameraManager.setViewTarget(
      {
        source,
        pose,
        projection,
      },
      { blendTimeSeconds: CAMERA_SOURCE_BLEND_SECONDS },
    );
    this.controller.cameraManager.update(deltaSeconds);
  }

  private cameraProjection(camera: CameraComponent | undefined): CameraProjection {
    return cameraProjectionFromComponent(camera);
  }
}

export const TPS_PLAYER_CONTROLLER: PlayerControllerDefinition = {
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
};

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
  playerController: TPS_PLAYER_CONTROLLER,
  createSession: (context) => new TpsCharacterSession(context, TPS_PLAYER_CONTROLLER),
};
