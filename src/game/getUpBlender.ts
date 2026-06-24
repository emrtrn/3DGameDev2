/**
 * Get-up blend: the smooth "dynamic ragdoll → kinematic animation" hand-back.
 *
 * A ragdoll displaces every driven bone's **local** transform (position and
 * rotation). An `AnimationMixer` only writes back the transform components a clip
 * actually has tracks for — typically rotation on most bones, position only on a
 * root/hips. So simply un-freezing the mixer after a ragdoll leaves the
 * un-animated components (e.g. a rigid limb's position) stuck at their collapsed
 * ragdoll values: the character would keep walking in a folded "sitting" pose.
 *
 * To avoid that, this blender eases each driven bone's local transform from its
 * collapsed ragdoll pose back to the **rest pose captured the instant the ragdoll
 * was activated** (the last clean standing/kinematic pose). The mixer stays frozen
 * during the blend, so the blender fully owns the pose; once it lands exactly on
 * the rest pose, the caller un-freezes the mixer, which then animates from a clean
 * pose — and leaves the un-animated components at their correct standing values.
 *
 * Blending in local space (not world) is continuous from the last ragdoll frame
 * (the driver wrote the same local last tick) and needs no scene-graph ordering.
 * The timing math (`getUpBlendFactor`) is pure and tested; the per-bone Three
 * writes are trivial glue covered by manual Play.
 */
import { Quaternion, Vector3 } from "three";
import type { Object3D } from "three";

/** A captured local transform a bone is eased back to during recovery. */
export interface RestPose {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly scale: Vector3;
}

/**
 * Smoothstep easing of a get-up blend, clamped to `[0, 1]`. `0` holds the captured
 * ragdoll pose, `1` is fully back on the rest pose. Pure. A zero/negative duration
 * snaps straight to `1`.
 */
export function getUpBlendFactor(elapsedSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 1;
  const t = Math.min(1, Math.max(0, elapsedSeconds / durationSeconds));
  return t * t * (3 - 2 * t);
}

/** Default get-up blend window (seconds) — a brisk push back onto the feet. */
export const DEFAULT_GET_UP_SECONDS = 0.55;

interface BlendEntry {
  readonly node: Object3D;
  readonly startPos: Vector3;
  readonly startQuat: Quaternion;
  readonly startScale: Vector3;
  readonly restPos: Vector3;
  readonly restQuat: Quaternion;
  readonly restScale: Vector3;
}

/**
 * Eases a set of bones from their current (ragdoll) local pose back to a captured
 * rest pose. Construct it when recovery begins — it snapshots each bone's current
 * local transform as the blend start — then call {@link update} each tick (with
 * the locomotion mixer kept frozen) until it returns `true`.
 */
export class GetUpBlender {
  private elapsed = 0;
  private readonly entries: BlendEntry[] = [];

  constructor(
    rest: ReadonlyMap<Object3D, RestPose>,
    private readonly durationSeconds = DEFAULT_GET_UP_SECONDS,
  ) {
    for (const [node, pose] of rest) {
      this.entries.push({
        node,
        startPos: node.position.clone(),
        startQuat: node.quaternion.clone(),
        startScale: node.scale.clone(),
        restPos: pose.position.clone(),
        restQuat: pose.quaternion.clone(),
        restScale: pose.scale.clone(),
      });
    }
  }

  /**
   * Advances the blend one tick and re-poses the bones toward their rest pose.
   * Returns `true` once the blend has completed (the caller should then un-freeze
   * the animator and drop the blender — the bones are exactly on the rest pose).
   */
  update(deltaSeconds: number): boolean {
    this.elapsed += Math.max(0, deltaSeconds);
    const s = getUpBlendFactor(this.elapsed, this.durationSeconds);
    for (const entry of this.entries) {
      entry.node.position.copy(entry.startPos).lerp(entry.restPos, s);
      entry.node.quaternion.copy(entry.startQuat).slerp(entry.restQuat, s);
      entry.node.scale.copy(entry.startScale).lerp(entry.restScale, s);
      entry.node.updateMatrix();
    }
    return s >= 1;
  }
}
