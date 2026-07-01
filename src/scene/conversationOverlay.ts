/**
 * Conversation choice overlay — the interactive half of the Dialogue & Voice
 * conversation UI (Faz D3). Line subtitles are still drawn by the
 * {@link SubtitleOverlay}; this overlay only appears on a `choice` node, showing
 * an optional prompt and one button per branch.
 *
 * Rendered into `#ui-overlay` and marked `.ui-interactive` so its buttons take
 * pointer events (the overlay root is otherwise click-through). Choices can also
 * be picked with the number keys 1–9, which works even when the pointer is
 * locked to the 3D view. The {@link ConversationDirector} owns flow; this only
 * reflects show/hide and reports the picked index.
 */

export interface ConversationChoiceOption {
  text: string;
}

export interface ConversationOverlayView {
  prompt?: string;
  choices: ReadonlyArray<ConversationChoiceOption>;
}

export class ConversationOverlay {
  private readonly root: HTMLDivElement;
  private readonly promptEl: HTMLParagraphElement;
  private readonly choicesEl: HTMLDivElement;
  private onChoose: ((index: number) => void) | null = null;
  private choiceCount = 0;

  constructor(host: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "forge-conversation ui-interactive";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Conversation choices");
    this.root.hidden = true;

    this.promptEl = document.createElement("p");
    this.promptEl.className = "forge-conversation-prompt";
    this.promptEl.hidden = true;

    this.choicesEl = document.createElement("div");
    this.choicesEl.className = "forge-conversation-choices";

    this.root.append(this.promptEl, this.choicesEl);
    host.appendChild(this.root);
    window.addEventListener("keydown", this.handleKeydown);
  }

  /** Shows the choice panel and reports the picked branch index via `onChoose`. */
  show(view: ConversationOverlayView, onChoose: (index: number) => void): void {
    this.onChoose = onChoose;
    this.choiceCount = view.choices.length;

    if (view.prompt && view.prompt.length > 0) {
      this.promptEl.textContent = view.prompt;
      this.promptEl.hidden = false;
    } else {
      this.promptEl.textContent = "";
      this.promptEl.hidden = true;
    }

    this.choicesEl.replaceChildren();
    view.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "forge-conversation-choice";
      // A leading number mirrors the 1–9 keyboard shortcut for the same branch.
      button.textContent = `${index + 1}. ${choice.text}`;
      button.addEventListener("click", () => this.pick(index));
      this.choicesEl.appendChild(button);
    });

    this.root.hidden = false;
  }

  hide(): void {
    this.onChoose = null;
    this.choiceCount = 0;
    this.root.hidden = true;
    this.promptEl.textContent = "";
    this.promptEl.hidden = true;
    this.choicesEl.replaceChildren();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeydown);
    this.root.remove();
    this.onChoose = null;
  }

  private pick(index: number): void {
    const handler = this.onChoose;
    if (!handler || index < 0 || index >= this.choiceCount) return;
    handler(index);
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.root.hidden || !this.onChoose) return;
    const digit = digitFromKey(event);
    if (digit === null || digit >= this.choiceCount) return;
    event.preventDefault();
    event.stopPropagation();
    this.pick(digit);
  };
}

/** Maps a number-row / numpad 1–9 key to a zero-based choice index, else null. */
function digitFromKey(event: KeyboardEvent): number | null {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  if (match?.[1]) return Number(match[1]) - 1;
  if (event.key >= "1" && event.key <= "9") return Number(event.key) - 1;
  return null;
}
