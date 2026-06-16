import { AnimationMixer } from "three";
import type { AnimationAction, AnimationClip, Object3D } from "three";

/**
 * Wraps a Three.js `AnimationMixer` over a character's clips and crossfades
 * between them by name. Generic render glue — it holds no game rules: the
 * runtime shell decides *which* clip to play (via the pure locomotion selector
 * in `src/game`) and calls {@link play}. The owned mixer is advanced once per
 * tick by the `AnimationSubsystem`.
 *
 * Three-touching, so it lives in `engine/render-three`, not `engine/core`.
 */
export class CrossfadeAnimator {
  readonly mixer: AnimationMixer;
  /** Names of the clips this animator can play. */
  readonly clips: ReadonlySet<string>;
  private readonly actions = new Map<string, AnimationAction>();
  private current: string | null = null;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.clips = new Set(this.actions.keys());
  }

  /** The clip currently playing (or fading in), or null before the first play. */
  get currentClip(): string | null {
    return this.current;
  }

  /**
   * Crossfades to `name` over `duration` seconds. A no-op when it is already the
   * current clip or the name is unknown. The first play snaps in (there is
   * nothing to fade from); a non-positive `duration` also snaps.
   */
  play(name: string, duration = 0.2): void {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    const prev = this.current ? this.actions.get(this.current) : undefined;
    if (prev && duration > 0) prev.crossFadeTo(next, duration, false);
    else if (prev) prev.stop();
    this.current = name;
  }
}
