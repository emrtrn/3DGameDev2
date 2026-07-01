/**
 * Conversation authoring schema (Dialogue & Voice, Faz D3).
 *
 * A `*.conversation.json` asset sequences authored dialogue lines into an
 * NPC conversation: a graph of nodes the runtime walks one step at a time.
 * Three node kinds cover the vertical slice:
 *
 * - `line`   → plays a {@link DialogueLineAsset} (by id) for a speaker voice,
 *   then auto-advances to `next` once the line's subtitle finishes.
 * - `choice` → pauses and presents player choices; the picked choice's `next`
 *   drives the branch.
 * - `event`  → fires a gameplay script message (`eventId`) and continues to
 *   `next` without pausing (fire-and-forget hook into the message system).
 *
 * The runner (`conversationRunner.ts`) is a pure, headless state machine over
 * this graph; the director (`conversationDirector.ts`) binds it to the
 * {@link DialogueSubsystem}, the choice UI, and the script-message bus. Nothing
 * here depends on Web Audio or the DOM.
 */

/** Discriminates the three conversation node kinds. */
export const CONVERSATION_NODE_KINDS = ["line", "choice", "event"] as const;
export type ConversationNodeKind = (typeof CONVERSATION_NODE_KINDS)[number];

/** Scalar payload values a conversation `event` node can forward to gameplay. */
export type ConversationEventPayload = Record<string, string | number | boolean>;

/**
 * Plays one dialogue line, then advances to `next`. When `next` is absent (or
 * names an unknown node) the conversation ends after the line finishes.
 */
export interface ConversationLineNode {
  id: string;
  kind: "line";
  /** Id of the {@link DialogueLineAsset} to play. */
  lineId: string;
  /** Speaking voice; also selects the line's context mapping + subtitle name. */
  speakerVoiceId: string;
  /** Listener voice, fed to the resolver's directed-target scoring. */
  targetVoiceId?: string;
  /** Locale override for line resolution (else the runtime default). */
  locale?: string;
  /** Node id to enter after the line ends (absent = end the conversation). */
  next?: string;
}

/** One selectable branch in a {@link ConversationChoiceNode}. */
export interface ConversationChoice {
  text: string;
  /** Node id entered when this choice is picked. */
  next: string;
}

/** Pauses for the player to pick one of `choices`; the pick drives the branch. */
export interface ConversationChoiceNode {
  id: string;
  kind: "choice";
  /** Optional line of prompt text shown above the choices. */
  prompt?: string;
  choices: ConversationChoice[];
}

/**
 * Fires a gameplay script message (`eventId`, with optional scalar `payload`)
 * and continues to `next` without pausing. Absent/unknown `next` ends the
 * conversation.
 */
export interface ConversationEventNode {
  id: string;
  kind: "event";
  /** Script-message type emitted onto the bus so gameplay can react. */
  eventId: string;
  /** Optional scalar payload forwarded with the emitted message. */
  payload?: ConversationEventPayload;
  next?: string;
}

export type ConversationNode =
  | ConversationLineNode
  | ConversationChoiceNode
  | ConversationEventNode;

/** One authored conversation graph. */
export interface ConversationAsset {
  schema: 1;
  type: "conversation";
  id: string;
  /** Display name for editor/debug surfaces (optional). */
  name?: string;
  nodes: ConversationNode[];
  /** Node id the conversation enters when started. */
  startNodeId: string;
}

export function isConversationNodeKind(value: unknown): value is ConversationNodeKind {
  return (
    typeof value === "string" &&
    CONVERSATION_NODE_KINDS.includes(value as ConversationNodeKind)
  );
}

export function isConversationAsset(value: unknown): value is ConversationAsset {
  return (
    !!value &&
    typeof value === "object" &&
    (value as ConversationAsset).type === "conversation" &&
    typeof (value as ConversationAsset).id === "string" &&
    Array.isArray((value as ConversationAsset).nodes) &&
    typeof (value as ConversationAsset).startNodeId === "string"
  );
}
