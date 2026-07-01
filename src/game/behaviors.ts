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
import {
  initialInteractionState,
  stepInteractionTrigger,
  type InteractionTriggerState,
} from "./interaction";

/**
 * Catalog of behavior script ids the runtime registry resolves. Authoring
 * surfaces (the Actor Script editor's Event Bindings) offer these as suggestions;
 * free-form ids are still allowed so an AI-authored behavior can be referenced
 * before it is registered here. Keep in sync with the `behaviors` map below.
 */
export const BEHAVIOR_SCRIPT_IDS = [
  "spin",
  "input-move",
  "collision-chime",
  "goal-reached",
  "interact",
  "use-toggleable",
  "lamp-toggle",
  "begin-conversation",
] as const;
export type BehaviorScriptId = (typeof BEHAVIOR_SCRIPT_IDS)[number];

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
  /**
   * Fired when an `interact` trigger fires (§3 Interaction runtime): the player
   * entered an interaction-marked sensor and it was enabled + off cooldown. The
   * project game rules interpret `action`; the shell logs it, tests spy on it.
   */
  onInteraction?: (entityId: string, action: string) => void;
  /**
   * Fired when an interaction sensor begins/ends overlap. Runtime shells can use
   * this for prompts without coupling UI code into the behavior layer.
   */
  onInteractionOverlap?: (
    entityId: string,
    action: string,
    prompt: string | undefined,
    overlapping: boolean,
  ) => void;
  /** Runtime shell sink for the built-in lamp-toggle behavior. */
  onActorLightToggle?: (entityId: string, enabled: boolean) => void;
  /** Runtime shell sink for one-shot actor VFX triggered by message behaviors. */
  onActorParticleEffect?: (entityId: string) => void;
  /**
   * Whether the named entity is the player-controlled (possessed) pawn this Play
   * boot. `input-move` only reads input + moves when this is true, so a character
   * carrying the behavior stays put unless the active Game Mode possesses it
   * (e.g. the default camera mode possesses no character). Absent means "always
   * controlled" so headless tests drive the behavior directly.
   */
  isPlayerControlled?: (entityId: string) => boolean;
}

function numberParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringParam(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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

/** Plays the entity's authored audio cue once, immediately (no contact gating). */
function playAudioCue(context: Parameters<BehaviorUpdate>[0]): void {
  const { audio, audioComponent, transform } = context;
  if (!audio || !audioComponent) return;
  audio.playOneShot(audioComponent.clipId, {
    volume: audioComponent.volume,
    loop: audioComponent.loop,
    spatial: audioComponent.spatial,
    // A spatial cue is pinned at the emitter's position so the PannerNode +
    // listener give it direction/distance; non-spatial cues ignore position.
    ...(audioComponent.spatial
      ? { position: [transform.position[0], transform.position[1], transform.position[2]] as const }
      : {}),
  });
}

function playCollisionAudioOnce(
  context: Parameters<BehaviorUpdate>[0],
): void {
  const { audio, audioComponent, entityId, physics } = context;
  if (!audio || !audioComponent) return;
  if ((physics?.contactsForEntity(entityId).length ?? 0) === 0) return;
  if (collisionAudioPlayed.has(entityId)) return;
  collisionAudioPlayed.add(entityId);
  playAudioCue(context);
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
  const onInteraction = options.onInteraction;
  const onInteractionOverlap = options.onInteractionOverlap;
  const onActorLightToggle = options.onActorLightToggle;
  const onActorParticleEffect = options.onActorParticleEffect;
  const isPlayerControlled = options.isPlayerControlled ?? (() => true);
  const vertical = new Map<string, PlayerVertical>();
  const reachedGoals = new Set<string>();
  const interactions = new Map<string, InteractionTriggerState>();
  const interactionOverlaps = new Map<string, boolean>();

  const inputMove: BehaviorUpdate = (context) => {
    // Only the possessed pawn responds to input. An authored `input-move`
    // character left unpossessed (e.g. under the default camera Game Mode) stays
    // exactly where it was placed instead of drifting on WASD.
    if (!isPlayerControlled(context.entityId)) return;

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

  // Interaction trigger (§3): an interaction-marked sensor entity whose first
  // contact with the kinematic player fires its action (host-interpreted),
  // playing the optional audio cue. Re-fires on a fresh re-enter once any
  // authored cooldown elapses. Reuses the goal-reached sensor + contact pattern,
  // with the edge/cooldown logic in the pure `stepInteractionTrigger` core.
  const interact: BehaviorUpdate = (context) => {
    const interaction = context.interactionComponent;
    if (!interaction) return;
    const prev = interactions.get(context.entityId) ?? initialInteractionState();
    const overlapping = (context.physics?.contactsForEntity(context.entityId).length ?? 0) > 0;
    const wasOverlapping = interactionOverlaps.get(context.entityId) ?? false;
    if (overlapping !== wasOverlapping) {
      interactionOverlaps.set(context.entityId, overlapping);
      onInteractionOverlap?.(
        context.entityId,
        interaction.action,
        interaction.prompt,
        overlapping,
      );
    }
    const inputAction = stringParam(context.params.inputAction);
    const result = stepInteractionTrigger(prev, {
      overlapping: inputAction ? overlapping && context.actions.pressed(inputAction) : overlapping,
      enabled: interaction.enabled ?? true,
      cooldown: interaction.cooldown ?? 0,
      dt: context.engine.deltaSeconds,
    });
    interactions.set(context.entityId, result.state);
    if (!result.fire) return;
    playAudioCue(context);
    const payload: Record<string, unknown> = {
      entityId: context.entityId,
      action: interaction.action,
    };
    if (interaction.prompt !== undefined) payload.prompt = interaction.prompt;
    const usableTargets = context.world.withInterface("Usable");
    const usableTarget = usableTargets.includes(context.entityId)
      ? context.entityId
      : context.world.nearestWithInterface(
          "Usable",
          context.entityId,
          numberParam(context.params.useRange, 2),
        );
    if (usableTarget) context.messages.send(usableTarget, "Usable.Use", payload);
    context.messages.emit("Interaction.Activated", payload);
    context.messages.emit(`Interaction.${interaction.action}`, payload);
    onInteraction?.(context.entityId, interaction.action);
  };

  const useToggleable: BehaviorUpdate = (context) => {
    context.messages.send(context.entityId, "Toggleable.Toggle", {
      source: context.message?.source ?? context.entityId,
    });
  };

  const lampToggle: BehaviorUpdate = (context) => {
    const enabled = context.state.toggle("enabled", true);
    onActorLightToggle?.(context.entityId, enabled);
    onActorParticleEffect?.(context.entityId);
    context.messages.emit("Lamp.Toggled", { enabled });
  };

  // Conversation bridge (§D3): emits the `start-conversation` script message the
  // runtime's ConversationDirector subscribes to, using the `conversationId`
  // param. Bind it to an NPC's interaction event (e.g. `Interaction.Talk`) via a
  // Message Binding so talking to the NPC starts its conversation graph. Kept
  // generic — no conversation content lives here, only the trigger.
  const beginConversation: BehaviorUpdate = (context) => {
    const conversationId = stringParam(context.params.conversationId);
    if (!conversationId) return;
    context.messages.emit("start-conversation", { conversationId });
  };

  const behaviors = new Map<string, BehaviorUpdate>([
    ["spin", spin],
    ["input-move", inputMove],
    ["collision-chime", collisionChime],
    ["goal-reached", goalReached],
    ["interact", interact],
    ["use-toggleable", useToggleable],
    ["lamp-toggle", lampToggle],
    ["begin-conversation", beginConversation],
  ]);
  return { get: (scriptId) => behaviors.get(scriptId) };
}
