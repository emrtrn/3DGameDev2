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

/** Crossfade duration (seconds) between locomotion clips. */
const ANIMATION_CROSSFADE_SECONDS = 0.18;

/** Resolves the explicit player character a TPS session should possess. */
function resolvePlayerCharacter(
  characters: readonly RuntimeCharacterRef[],
): RuntimeCharacterRef | undefined {
  const tagged = characters.find((ref) => ref.placement.metadata?.player === true);
  if (tagged) return tagged;
  const actorCharacter = characters.find((ref) => ref.hasCharacterMovement);
  if (actorCharacter) return actorCharacter;
  return characters.find((ref) => ref.placement.behavior?.script === "input-move");
}

class TpsCharacterSession implements GameModeSession {
  readonly playerState: PlayerState = { pawnEntityId: null, possessed: false };
  readonly gameState: GameState = { elapsedSeconds: 0 };
  private player: RuntimeCharacterRef | null = null;
  private animator: CrossfadeAnimator | null = null;
  private followPose: FollowCameraPose | null = null;

  constructor(private readonly context: GameModeContext) {}

  spawnDefaultPawn(): void {
    this.player = resolvePlayerCharacter(this.context.characters) ?? null;
    this.playerState.pawnEntityId = this.player?.entityId ?? null;
  }

  possess(): void {
    const player = this.player;
    if (!player) return;
    this.playerState.possessed = true;
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

  dispose(): void {
    // The animator's mixer is owned by the AnimationSubsystem (disposed by the
    // EngineApp); nothing extra to release here.
  }

  private updateFollowCamera(player: RuntimeCharacterRef, deltaSeconds: number): void {
    const pos: Vec3 = [player.object.position.x, player.object.position.y, player.object.position.z];
    const t = smoothingFactor(FOLLOW_CAMERA_RATE, deltaSeconds);
    this.followPose = stepFollowCamera(this.followPose, pos, FOLLOW_CAMERA_CONFIG, t);
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
    inputActions: ["move-forward", "move-back", "move-left", "move-right", "jump", "sprint"],
    possess: "first-input-move-character",
  },
  createSession: (context) => new TpsCharacterSession(context),
};
