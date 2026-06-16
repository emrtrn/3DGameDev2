/**
 * Runtime/game behavior registry: concrete script id -> update function map.
 *
 * Game content lives here, not in the engine. Each behavior receives the engine
 * tick context, the input action map, its authored params, and a mutable entity
 * transform it may edit. The BehaviorSubsystem syncs the transform back to the
 * rendered object after each tick.
 */
import type {
  BehaviorRegistry,
  BehaviorUpdate,
} from "@engine/behavior/behaviorSubsystem";
import { facingYawFromMove, planarMoveStep } from "./playerMovement";
import { groundedAt, stepVerticalMotion, type VerticalMotionState } from "./verticalMotion";
import { resolvePlanarMovement, type PlanarDelta } from "./collision";
import type { LocomotionInput } from "./locomotionAnimation";

/** Gravity used when the host does not inject one (e.g. headless tests). */
const DEFAULT_GRAVITY_Y = -9.81;

/** Host-provided dependencies for the runtime behaviors. */
export interface BehaviorRegistryOptions {
  /** World gravity on Y (units/s^2; negative = down). Defaults to -9.81. */
  getGravityY?: () => number;
  /**
   * Sink for the player's per-tick movement snapshot, which the runtime shell
   * maps to an animation clip (G5). Optional: headless tests omit it.
   */
  reportLocomotion?: (entityId: string, report: LocomotionInput) => void;
  /**
   * Fired once when a `goal-reached` trigger first registers a contact (G6).
   * The runtime shell uses it for feedback (e.g. a log); headless tests spy on it.
   */
  onGoalReached?: (entityId: string) => void;
}

function numberParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Spins an entity around one axis at `speedDeg` degrees per second. */
const spin: BehaviorUpdate = ({ engine, params, transform }) => {
  const speedDeg = numberParam(params.speedDeg, 90);
  const axis = params.axis === "x" ? 0 : params.axis === "z" ? 2 : 1;
  transform.rotation[axis] += speedDeg * engine.deltaSeconds;
};

/**
 * Moves an entity on the XZ plane from the named movement actions at `speed`
 * units per second. Demonstrates the spine driving gameplay from input.
 */
const collisionAudioPlayed = new Set<string>();

function playCollisionAudioOnce(
  context: Parameters<BehaviorUpdate>[0],
): void {
  const { audio, audioComponent, entityId, physics } = context;
  if (!audio || !audioComponent) return;
  if ((physics?.contactsForEntity(entityId).length ?? 0) === 0) return;
  if (collisionAudioPlayed.has(entityId)) return;
  collisionAudioPlayed.add(entityId);
  audio.playOneShot(audioComponent.clipId, {
    volume: audioComponent.volume,
    loop: audioComponent.loop,
    spatial: audioComponent.spatial,
  });
}

const collisionChime: BehaviorUpdate = playCollisionAudioOnce;

/**
 * Clamps a proposed planar move so the entity cannot enter static colliders,
 * using the AABBs the physics subsystem already derives. Falls back to the raw
 * move when there is no physics query, no blockers, or no collider on the entity.
 */
function resolvePlanarAgainstBlockers(
  context: Parameters<BehaviorUpdate>[0],
  planar: PlanarDelta,
): PlanarDelta {
  const { physics, entityId, transform } = context;
  if (!physics) return planar;
  const blockers = physics.staticBlockerAabbs();
  if (blockers.length === 0) return planar;
  const half = physics.colliderHalfExtents(entityId);
  if (!half) return planar;
  return resolvePlanarMovement(transform.position, planar, half, blockers);
}

/** Per-entity vertical motion state plus the floor height captured on entry. */
interface PlayerVertical {
  state: VerticalMotionState;
  floorY: number;
}

/**
 * Builds the runtime behavior registry used by the BehaviorSubsystem. Vertical
 * (gravity/jump) state is scoped to this registry instance, so it starts fresh
 * on each scene load and never leaks between scenes.
 */
export function createBehaviorRegistry(options: BehaviorRegistryOptions = {}): BehaviorRegistry {
  const getGravityY = options.getGravityY ?? (() => DEFAULT_GRAVITY_Y);
  const reportLocomotion = options.reportLocomotion;
  const onGoalReached = options.onGoalReached;
  const vertical = new Map<string, PlayerVertical>();
  const reachedGoals = new Set<string>();

  const inputMove: BehaviorUpdate = (context) => {
    const { engine, actions, params, transform } = context;

    // Planar movement (G1) resolved against static blockers (G3), then facing.
    // Holding sprint scales the base speed so the run animation state (G5) can
    // be reached; the intended (pre-collision) speed drives the animation.
    const baseSpeed = numberParam(params.speed, 3);
    const speed = actions.held("sprint")
      ? baseSpeed * numberParam(params.sprintMultiplier, 2)
      : baseSpeed;
    const planar = planarMoveStep(
      {
        forward: actions.held("move-forward"),
        back: actions.held("move-back"),
        left: actions.held("move-left"),
        right: actions.held("move-right"),
      },
      speed,
      engine.deltaSeconds,
    );
    const { dx, dz } = resolvePlanarAgainstBlockers(context, planar);
    transform.position[0] += dx;
    transform.position[2] += dz;
    const yaw = facingYawFromMove(dx, dz);
    if (yaw !== null) transform.rotation[1] = yaw;

    // Gravity + jump (G2). The first tick captures the authored height as the
    // floor the entity rests on and jumps from.
    let runtime = vertical.get(context.entityId);
    if (!runtime) {
      const floorY = transform.position[1];
      runtime = { state: groundedAt(floorY), floorY };
      vertical.set(context.entityId, runtime);
    }
    runtime.state = stepVerticalMotion(runtime.state, {
      gravityY: getGravityY(),
      jumpSpeed: numberParam(params.jumpSpeed, 4),
      floorY: runtime.floorY,
      dt: engine.deltaSeconds,
      jump: actions.pressed("jump"),
    });
    transform.position[1] = runtime.state.y;

    // Report the movement snapshot (G5) so the shell can pick a clip. Speed is
    // the intended planar speed (before collision), so pushing into a wall still
    // animates as walking/running rather than freezing to idle.
    reportLocomotion?.(context.entityId, {
      planarSpeed: engine.deltaSeconds > 0 ? Math.hypot(planar.dx, planar.dz) / engine.deltaSeconds : 0,
      grounded: runtime.state.grounded,
      velocityY: runtime.state.velocityY,
    });

    playCollisionAudioOnce(context);
  };

  // Goal trigger (G6): a sensor-collider entity whose first contact (only the
  // kinematic player can touch a static sensor) plays its audio cue once and
  // signals the shell. Reuses the contact + once pattern; no HUD.
  const goalReached: BehaviorUpdate = (context) => {
    if (reachedGoals.has(context.entityId)) return;
    if ((context.physics?.contactsForEntity(context.entityId).length ?? 0) === 0) return;
    reachedGoals.add(context.entityId);
    playCollisionAudioOnce(context);
    onGoalReached?.(context.entityId);
  };

  const behaviors = new Map<string, BehaviorUpdate>([
    ["spin", spin],
    ["input-move", inputMove],
    ["collision-chime", collisionChime],
    ["goal-reached", goalReached],
  ]);
  return { get: (scriptId) => behaviors.get(scriptId) };
}
