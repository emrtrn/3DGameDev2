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
import { LayeredCharacterAnimator } from "@engine/render-three/layeredCharacterAnimator";
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
  locomotionConfigForSkeleton,
  resolveLocomotionAnimation,
  DEFAULT_LOCOMOTION_THRESHOLDS,
  EMPTY_LOCOMOTION_CONFIG,
  type LocomotionAssetConfig,
} from "@/game/locomotionAnimation";
import type {
  AssetSkeletonMontageDef,
  MontageTriggerDef,
  MontageTriggerMode,
} from "@/scene/assetSkeletonLoader";
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

/** An upper-body montage resolved to the input action + mode that triggers it. */
export interface MontageBinding {
  readonly clip: string;
  readonly action: string;
  readonly mode: MontageTriggerMode;
  readonly blendInSeconds: number;
  readonly blendOutSeconds: number;
}

/**
 * Resolves authored upper-body montages to input bindings. An explicit
 * `trigger` wins; otherwise the TPS naming convention applies (a montage named
 * "aim" holds, one named "fire" presses) so characters authored before the
 * trigger field keep their behavior. Montages without either are skipped (they
 * are triggered by game code, not input).
 */
export function resolveMontageBindings(
  montages: readonly AssetSkeletonMontageDef[] | undefined,
): MontageBinding[] {
  const bindings: MontageBinding[] = [];
  for (const montage of montages ?? []) {
    if (montage.slot !== "upperBody") continue;
    const trigger = montage.trigger ?? defaultTriggerForName(montage.name);
    if (!trigger) continue;
    bindings.push({
      clip: montage.clip,
      action: trigger.action,
      mode: trigger.mode,
      blendInSeconds: montage.blendInSeconds,
      blendOutSeconds: montage.blendOutSeconds,
    });
  }
  return bindings;
}

function defaultTriggerForName(name: string): MontageTriggerDef | null {
  if (name === "aim") return { action: "aim", mode: "hold" };
  if (name === "fire") return { action: "fire", mode: "press" };
  return null;
}

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
  /** Full-body crossfade animator (used when no upper-body layering is authored). */
  private animator: CrossfadeAnimator | null = null;
  /** Layered animator (legs locomotion + upper-body slot) when authored. */
  private layered: LayeredCharacterAnimator | null = null;
  /** Clip names available on the active animator, for the locomotion selector. */
  private clipNames: ReadonlySet<string> = new Set();
  /** Input-bound upper-body montages, split by trigger mode. */
  private holdMontages: MontageBinding[] = [];
  private pressMontages: MontageBinding[] = [];
  /** The player asset's authored locomotion config (blend space + anim-set). */
  private locomotionConfig: LocomotionAssetConfig = EMPTY_LOCOMOTION_CONFIG;
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
    // Snap to the authored idle clip so it never flashes a bind pose.
    const initialClip = player.placement.animation ?? "idle";
    // An authored upper-body bone enables the layered animator (legs locomotion +
    // upper-body montage slot); otherwise fall back to the full-body crossfade.
    const upperBodyBone = player.skeleton?.upperBodyBone;
    const layered = upperBodyBone
      ? new LayeredCharacterAnimator(player.object, player.gltf.animations, upperBodyBone)
      : null;
    if (layered?.hasUpperBody) {
      this.layered = layered;
      for (const mixer of layered.mixers) this.context.addMixer(mixer);
      layered.playLocomotion(initialClip, 0);
      this.clipNames = layered.clips;
    } else {
      const animator = new CrossfadeAnimator(player.object, player.gltf.animations);
      animator.play(initialClip, 0);
      this.context.addMixer(animator.mixer);
      this.animator = animator;
      this.clipNames = animator.clips;
    }
    // Resolve the authored locomotion config (blend space + anim-set) from the
    // character's skeleton sidecar; drives grounded blending and clip selection.
    this.locomotionConfig = locomotionConfigForSkeleton(player.skeleton);
    const bindings = resolveMontageBindings(player.skeleton?.montages);
    this.holdMontages = bindings.filter((binding) => binding.mode === "hold");
    this.pressMontages = bindings.filter((binding) => binding.mode === "press");
    // Following the player owns the view; stop the resize handler resetting it.
    this.context.markCameraControlled();
  }

  update(deltaSeconds: number): void {
    this.gameState.elapsedSeconds += deltaSeconds;
    const player = this.player;
    if (!player) return;
    this.updateFollowCamera(player, deltaSeconds);
    this.updateAnimation(player, deltaSeconds);
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

  private updateAnimation(player: RuntimeCharacterRef, deltaSeconds: number): void {
    const report = this.context.getLocomotion(player.entityId);
    if (report) {
      const result = resolveLocomotionAnimation(
        report,
        this.clipNames,
        this.locomotionConfig,
        DEFAULT_LOCOMOTION_THRESHOLDS,
      );
      if (this.layered) {
        if (result.kind === "blend") this.layered.playLocomotionBlend(result.weights);
        else if (result.clip) this.layered.playLocomotion(result.clip, ANIMATION_CROSSFADE_SECONDS);
      } else if (this.animator) {
        if (result.kind === "blend") this.animator.playBlend(result.weights);
        else if (result.clip) this.animator.play(result.clip, ANIMATION_CROSSFADE_SECONDS);
      }
    }
    this.updateUpperBody(deltaSeconds);
  }

  /**
   * Drives the upper-body slot from authored montage input bindings: `hold`
   * montages layer a pose over locomotion while their action is held (the first
   * one wins); `press` montages fire a one-shot on the press tick. Bindings come
   * from the skeleton sidecar — explicit triggers or the aim/fire convention.
   * Only runs when a layered animator (an authored upper-body bone) exists.
   */
  private updateUpperBody(deltaSeconds: number): void {
    const layered = this.layered;
    if (!layered) return;
    const gameInput = this.context.getInputMode() !== "ui";
    if (this.holdMontages.length > 0) {
      const active = gameInput
        ? this.holdMontages.find((binding) => this.context.actions.held(binding.action)) ?? null
        : null;
      layered.setAim(active ? active.clip : null, active?.blendInSeconds ?? 0.18);
    }
    if (gameInput) {
      for (const binding of this.pressMontages) {
        if (this.context.actions.pressed(binding.action)) {
          layered.playMontage(binding.clip, {
            blendInSeconds: binding.blendInSeconds,
            blendOutSeconds: binding.blendOutSeconds,
          });
        }
      }
    }
    layered.update(deltaSeconds);
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
