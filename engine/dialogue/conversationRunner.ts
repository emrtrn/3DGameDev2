/**
 * Conversation runner — a pure, headless state machine over a
 * {@link ConversationAsset} graph. No Web Audio, no DOM, no dialogue playback:
 * it only decides *which node is current* and *what the host should do next*.
 *
 * The host drives it with three inputs and reacts to the returned
 * {@link ConversationTransition}:
 *
 * - `start()`  → enter `startNodeId`.
 * - `advance()`→ called when the current line's subtitle finished; follow `next`.
 * - `choose(i)`→ called when the player picked choice `i`; follow that branch.
 *
 * `event` nodes never pause: the runner walks through them, collecting each as
 * an emitted event on the transition, until it reaches a `line`/`choice` node
 * (which pauses) or the graph ends. This keeps the director's dispatch simple:
 * fire the events, then act on the single pausing {@link ConversationStep}.
 *
 * Also exports {@link validateConversation} for structural authoring checks.
 */
import type {
  ConversationAsset,
  ConversationEventPayload,
  ConversationNode,
} from "./conversationTypes";
import { isConversationNodeKind } from "./conversationTypes";

/** A pausing step the host must render/play, or the terminal `end`. */
export type ConversationStep =
  | {
      kind: "line";
      nodeId: string;
      lineId: string;
      speakerVoiceId: string;
      targetVoiceId?: string;
      locale?: string;
    }
  | {
      kind: "choice";
      nodeId: string;
      prompt?: string;
      choices: ReadonlyArray<{ text: string; next: string }>;
    }
  | { kind: "end" };

/** A gameplay event fired while walking through an `event` node. */
export interface ConversationEmittedEvent {
  nodeId: string;
  eventId: string;
  payload?: ConversationEventPayload;
}

/** Result of a runner input: events fired en route, plus the pausing step. */
export interface ConversationTransition {
  events: ConversationEmittedEvent[];
  step: ConversationStep;
}

export type ConversationRunnerStatus = "idle" | "active" | "ended";

/**
 * Walks a conversation graph. Not reusable across conversations — construct one
 * per playthrough (the director does this on `start`).
 */
export class ConversationRunner {
  private readonly nodesById = new Map<string, ConversationNode>();
  private readonly startNodeId: string;
  private currentStep: ConversationStep = { kind: "end" };
  private statusValue: ConversationRunnerStatus = "idle";

  constructor(conversation: ConversationAsset) {
    for (const node of conversation.nodes) {
      // First declaration wins on a duplicate id (validateConversation flags it).
      if (!this.nodesById.has(node.id)) this.nodesById.set(node.id, node);
    }
    this.startNodeId = conversation.startNodeId;
  }

  status(): ConversationRunnerStatus {
    return this.statusValue;
  }

  /** The current pausing step (`end` before `start()` or after the graph ends). */
  getCurrentStep(): ConversationStep {
    return this.currentStep;
  }

  /** Enters `startNodeId`. Safe to call again to restart from the top. */
  start(): ConversationTransition {
    return this.enter(this.startNodeId);
  }

  /**
   * Advances from the current `line` node to its `next`. Returns null when the
   * runner is not paused on a line (so a stray line-end can't derail a choice).
   */
  advance(): ConversationTransition | null {
    if (this.statusValue !== "active" || this.currentStep.kind !== "line") return null;
    const node = this.nodesById.get(this.currentStep.nodeId);
    const next = node && node.kind === "line" ? node.next : undefined;
    return this.enter(next);
  }

  /**
   * Follows choice `index` from the current `choice` node. Returns null when the
   * runner is not paused on a choice or the index is out of range.
   */
  choose(index: number): ConversationTransition | null {
    if (this.statusValue !== "active" || this.currentStep.kind !== "choice") return null;
    const choice = this.currentStep.choices[index];
    if (!choice) return null;
    return this.enter(choice.next);
  }

  /**
   * Walks from `nodeId`, firing `event` nodes into the transition, until it
   * reaches a `line`/`choice` node (pausing) or runs off the graph (ending).
   * A visited-set caps event chains so an authored `event → event` cycle ends
   * the conversation instead of looping forever.
   */
  private enter(nodeId: string | undefined): ConversationTransition {
    const events: ConversationEmittedEvent[] = [];
    const visitedEvents = new Set<string>();
    let cursor = nodeId;

    for (;;) {
      if (cursor === undefined) return this.end(events);
      const node = this.nodesById.get(cursor);
      if (!node) return this.end(events);

      if (node.kind === "event") {
        if (visitedEvents.has(node.id)) return this.end(events); // cycle guard
        visitedEvents.add(node.id);
        const event: ConversationEmittedEvent = { nodeId: node.id, eventId: node.eventId };
        if (node.payload) event.payload = node.payload;
        events.push(event);
        cursor = node.next;
        continue;
      }

      if (node.kind === "line") {
        const step: ConversationStep = {
          kind: "line",
          nodeId: node.id,
          lineId: node.lineId,
          speakerVoiceId: node.speakerVoiceId,
        };
        if (node.targetVoiceId) step.targetVoiceId = node.targetVoiceId;
        if (node.locale) step.locale = node.locale;
        return this.pause(step, events);
      }

      // choice
      const step: ConversationStep = {
        kind: "choice",
        nodeId: node.id,
        choices: node.choices.map((choice) => ({ text: choice.text, next: choice.next })),
      };
      if (node.prompt !== undefined) step.prompt = node.prompt;
      return this.pause(step, events);
    }
  }

  private pause(step: ConversationStep, events: ConversationEmittedEvent[]): ConversationTransition {
    this.currentStep = step;
    this.statusValue = "active";
    return { events, step };
  }

  private end(events: ConversationEmittedEvent[]): ConversationTransition {
    this.currentStep = { kind: "end" };
    this.statusValue = "ended";
    return { events, step: this.currentStep };
  }
}

export interface ValidateConversationOptions {
  /** Known dialogue line ids; when provided, unknown `lineId`s are reported. */
  lineIds?: ReadonlySet<string>;
  /** Known voice ids; when provided, unknown speaker/target voices are reported. */
  voiceIds?: ReadonlySet<string>;
}

/**
 * Structural validation of a conversation asset. Returns issues (empty = ok),
 * matching the string-list style of the dialogue validators.
 */
export function validateConversation(
  conversation: ConversationAsset,
  options: ValidateConversationOptions = {},
): string[] {
  const issues: string[] = [];
  if (!conversation.id) issues.push("Conversation has no id");
  if (!Array.isArray(conversation.nodes) || conversation.nodes.length === 0) {
    issues.push(`Conversation "${conversation.id}" has no nodes`);
    return issues;
  }

  const nodeIds = new Set<string>();
  for (const node of conversation.nodes) {
    if (!node.id) {
      issues.push(`Conversation "${conversation.id}" has a node with no id`);
      continue;
    }
    if (nodeIds.has(node.id)) {
      issues.push(`Conversation "${conversation.id}" repeats node id: ${node.id}`);
    } else {
      nodeIds.add(node.id);
    }
    if (!isConversationNodeKind(node.kind)) {
      issues.push(`Conversation "${conversation.id}" node "${node.id}" has an invalid kind`);
    }
  }

  if (!conversation.startNodeId) {
    issues.push(`Conversation "${conversation.id}" has no startNodeId`);
  } else if (!nodeIds.has(conversation.startNodeId)) {
    issues.push(
      `Conversation "${conversation.id}" startNodeId references missing node: ${conversation.startNodeId}`,
    );
  }

  const checkNext = (next: string | undefined, where: string): void => {
    if (next !== undefined && !nodeIds.has(next)) {
      issues.push(`${where} next references missing node: ${next}`);
    }
  };

  for (const node of conversation.nodes) {
    const where = `Conversation "${conversation.id}" node "${node.id}"`;
    if (node.kind === "line") {
      if (!node.lineId) {
        issues.push(`${where} has no lineId`);
      } else if (options.lineIds && !options.lineIds.has(node.lineId)) {
        issues.push(`${where} references missing dialogue line: ${node.lineId}`);
      }
      if (!node.speakerVoiceId) {
        issues.push(`${where} has no speakerVoiceId`);
      } else if (options.voiceIds && !options.voiceIds.has(node.speakerVoiceId)) {
        issues.push(`${where} references missing speaker voice: ${node.speakerVoiceId}`);
      }
      if (options.voiceIds && node.targetVoiceId && !options.voiceIds.has(node.targetVoiceId)) {
        issues.push(`${where} references missing target voice: ${node.targetVoiceId}`);
      }
      checkNext(node.next, where);
    } else if (node.kind === "choice") {
      if (!Array.isArray(node.choices) || node.choices.length === 0) {
        issues.push(`${where} has no choices`);
      } else {
        node.choices.forEach((choice, index) => {
          if (!choice.text) issues.push(`${where} choice ${index} has no text`);
          if (!choice.next) {
            issues.push(`${where} choice ${index} has no next`);
          } else if (!nodeIds.has(choice.next)) {
            issues.push(`${where} choice ${index} next references missing node: ${choice.next}`);
          }
        });
      }
    } else if (node.kind === "event") {
      if (!node.eventId) issues.push(`${where} has no eventId`);
      checkNext(node.next, where);
    }
  }

  return issues;
}
