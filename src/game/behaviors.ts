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

const inputMove: BehaviorUpdate = (context) => {
  const { engine, actions, params, transform } = context;
  const { dx, dz } = planarMoveStep(
    {
      forward: actions.held("move-forward"),
      back: actions.held("move-back"),
      left: actions.held("move-left"),
      right: actions.held("move-right"),
    },
    numberParam(params.speed, 3),
    engine.deltaSeconds,
  );
  transform.position[0] += dx;
  transform.position[2] += dz;
  const yaw = facingYawFromMove(dx, dz);
  if (yaw !== null) transform.rotation[1] = yaw;
  playCollisionAudioOnce(context);
};

const collisionChime: BehaviorUpdate = playCollisionAudioOnce;

/** Builds the runtime behavior registry used by the BehaviorSubsystem. */
export function createBehaviorRegistry(): BehaviorRegistry {
  const behaviors = new Map<string, BehaviorUpdate>([
    ["spin", spin],
    ["input-move", inputMove],
    ["collision-chime", collisionChime],
  ]);
  return { get: (scriptId) => behaviors.get(scriptId) };
}
