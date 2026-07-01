/**
 * Conversation director — headless orchestration that binds a
 * {@link ConversationRunner} to its side effects through injected callbacks.
 * Pure of Web Audio / DOM: the runtime host supplies `playLine` (→
 * DialogueSubsystem), `emitEvent` (→ script-message bus), and the choice-UI
 * hooks, so this stays testable with plain spies.
 *
 * Only one conversation runs at a time. The director tracks the line a running
 * conversation is waiting on so that {@link notifyLineEnd} — fed from the
 * DialogueSubsystem's global `onLineEnd` — only advances when *its own* line
 * finished naturally (a `play-dialogue` bark, or an interrupted line, is
 * ignored).
 */
import {
  ConversationRunner,
  type ConversationEmittedEvent,
  type ConversationTransition,
} from "./conversationRunner";
import type { ConversationAsset } from "./conversationTypes";
import type { DialoguePlayContext } from "./dialogueTypes";

/** A choice node handed to the UI: prompt plus the selectable option texts. */
export interface ConversationChoiceView {
  conversationId: string;
  nodeId: string;
  prompt?: string;
  choices: ReadonlyArray<{ text: string }>;
}

export interface ConversationDirectorCallbacks {
  /** Play a line node's dialogue (host wires this to `DialogueSubsystem.playLine`). */
  playLine(lineId: string, context: DialoguePlayContext): void;
  /** Fire an `event` node onto the gameplay message bus. */
  emitEvent(event: ConversationEmittedEvent): void;
  /** Show the choice UI for a `choice` node. */
  showChoices(view: ConversationChoiceView): void;
  /** Hide the choice UI (on branch taken, end, or stop). */
  hideChoices(): void;
  /** Stop a still-playing line when a conversation is force-stopped/replaced. */
  stopLine?(lineId: string): void;
  onStart?(conversationId: string): void;
  onEnd?(conversationId: string): void;
}

interface ActiveConversation {
  id: string;
  runner: ConversationRunner;
  /** Line id the runner is paused on, or null when paused on a choice. */
  waitingLineId: string | null;
}

export class ConversationDirector {
  private readonly conversations = new Map<string, ConversationAsset>();
  private active: ActiveConversation | null = null;

  constructor(private readonly callbacks: ConversationDirectorCallbacks) {}

  /** Registers (or replaces) a conversation asset by id. */
  register(conversation: ConversationAsset): void {
    this.conversations.set(conversation.id, conversation);
  }

  has(conversationId: string): boolean {
    return this.conversations.has(conversationId);
  }

  isActive(): boolean {
    return this.active !== null;
  }

  activeId(): string | null {
    return this.active?.id ?? null;
  }

  /** Drops all registered conversations (scene teardown/reload). */
  clear(): void {
    this.stop();
    this.conversations.clear();
  }

  /**
   * Starts the named conversation. Replaces any running one. Returns false when
   * the id is unknown (nothing started).
   */
  start(conversationId: string): boolean {
    const asset = this.conversations.get(conversationId);
    if (!asset) return false;
    if (this.active) this.stop();
    const runner = new ConversationRunner(asset);
    this.active = { id: conversationId, runner, waitingLineId: null };
    this.callbacks.onStart?.(conversationId);
    this.dispatch(runner.start());
    return true;
  }

  /** Picks choice `index` from the running conversation's current choice node. */
  choose(index: number): void {
    const active = this.active;
    if (!active) return;
    const transition = active.runner.choose(index);
    if (!transition) return;
    this.callbacks.hideChoices();
    this.dispatch(transition);
  }

  /**
   * Reports that a dialogue line finished. Advances the running conversation
   * only when the finished line is the one it is waiting on and it ended
   * naturally (`interrupted === false`).
   */
  notifyLineEnd(lineId: string, interrupted: boolean): void {
    const active = this.active;
    if (!active || active.waitingLineId !== lineId) return;
    active.waitingLineId = null;
    if (interrupted) return;
    const transition = active.runner.advance();
    if (transition) this.dispatch(transition);
  }

  /** Force-stops the running conversation (scene teardown / replaced by a new one). */
  stop(): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    this.callbacks.hideChoices();
    if (active.waitingLineId) this.callbacks.stopLine?.(active.waitingLineId);
    this.callbacks.onEnd?.(active.id);
  }

  /** Fires the transition's events, then acts on its pausing step. */
  private dispatch(transition: ConversationTransition): void {
    for (const event of transition.events) this.callbacks.emitEvent(event);
    const active = this.active;
    if (!active) return;
    const step = transition.step;
    if (step.kind === "line") {
      active.waitingLineId = step.lineId;
      const context: DialoguePlayContext = { speakerVoiceId: step.speakerVoiceId };
      if (step.targetVoiceId) context.targetVoiceId = step.targetVoiceId;
      if (step.locale) context.locale = step.locale;
      this.callbacks.playLine(step.lineId, context);
    } else if (step.kind === "choice") {
      active.waitingLineId = null;
      this.callbacks.showChoices({
        conversationId: active.id,
        nodeId: step.nodeId,
        ...(step.prompt !== undefined ? { prompt: step.prompt } : {}),
        choices: step.choices.map((choice) => ({ text: choice.text })),
      });
    } else {
      // end
      const id = active.id;
      this.active = null;
      this.callbacks.hideChoices();
      this.callbacks.onEnd?.(id);
    }
  }
}
