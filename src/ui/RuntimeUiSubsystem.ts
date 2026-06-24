/**
 * Runtime UI host (UMG Lite).
 *
 * Owns two stacked regions inside the `#ui-overlay` DOM layer:
 *   - **HUD layer** (`setHud`) — one persistent, non-interactive widget pinned at
 *     the bottom. Click-through (`pointer-events: none`), so a HUD never steals
 *     pointer/orbit gestures from the 3D viewport.
 *   - **Screen stack** (`pushScreen`/`replaceScreen`/`popScreen`/`back`) — menus
 *     and modals layered above the HUD. Each screen is a full-frame *scrim*
 *     (`pointer-events: auto`) so an open menu blocks click-through to the canvas
 *     (no accidental camera re-capture) and the top screen owns input.
 *
 * Widget actions are split by kind: a `back` action pops the top screen here
 * (Common UI's cancel); a `message` action is forwarded out via
 * {@link RuntimeUiSubsystemOptions.onMessageAction} for the game layer to react
 * to. {@link RuntimeUiSubsystemOptions.onScreenStackChange} fires whenever the
 * stack depth changes, so the app can route input (suppress gameplay while a
 * menu is up, resume when it closes).
 *
 * Generic by design — no project rules live here. The game decides *which*
 * widget to show and *how* to react to its messages.
 */
import {
  normalizeUiWidgetDef,
  type UiAction,
  type UiWidgetDef,
} from "@engine/ui/uiWidget";
import { renderUiWidget, type RenderedUiWidget } from "@engine/ui/uiRenderer";

export interface RuntimeUiSubsystemOptions {
  /** Invoked when a `message`-kind widget action fires (UI → gameplay). */
  onMessageAction?: (action: Extract<UiAction, { type: "message" }>, nodeId: string) => void;
  /** Invoked after the screen-stack depth changes (push/pop/clear). */
  onScreenStackChange?: (depth: number) => void;
}

interface ScreenEntry {
  layer: HTMLElement;
  rendered: RenderedUiWidget;
}

export class RuntimeUiSubsystem {
  private readonly hudLayer: HTMLElement;
  private readonly screenRoot: HTMLElement;
  private hud: RenderedUiWidget | null = null;
  private readonly screens: ScreenEntry[] = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly options: RuntimeUiSubsystemOptions = {},
  ) {
    this.hudLayer = document.createElement("div");
    this.hudLayer.className = "forge-ui-hud-layer";
    this.screenRoot = document.createElement("div");
    this.screenRoot.className = "forge-ui-screen-root";
    // HUD first (bottom), screens above — order is fixed regardless of call timing.
    this.host.appendChild(this.hudLayer);
    this.host.appendChild(this.screenRoot);
  }

  /** Number of screens currently on the stack (0 when only the HUD, if any, shows). */
  get screenDepth(): number {
    return this.screens.length;
  }

  // --- HUD layer -----------------------------------------------------------

  /** Renders the persistent HUD widget, replacing any current one. */
  setHud(def: UiWidgetDef | unknown): RenderedUiWidget {
    const widget = isUiWidgetDef(def) ? def : normalizeUiWidgetDef(def);
    this.clearHud();
    const rendered = renderUiWidget(widget, { onAction: this.handleAction });
    this.hudLayer.appendChild(rendered.element);
    this.hud = rendered;
    return rendered;
  }

  clearHud(): void {
    this.hud?.dispose();
    this.hud = null;
  }

  // --- Screen stack --------------------------------------------------------

  /** Pushes a screen on top of the stack and returns its handle. */
  pushScreen(def: UiWidgetDef | unknown): RenderedUiWidget {
    const widget = isUiWidgetDef(def) ? def : normalizeUiWidgetDef(def);
    const prevDepth = this.screens.length;
    const layer = document.createElement("div");
    layer.className = "forge-ui-screen-layer";
    const rendered = renderUiWidget(widget, { onAction: this.handleAction });
    layer.appendChild(rendered.element);
    this.screenRoot.appendChild(layer);
    this.screens.push({ layer, rendered });
    this.fireStackChange(prevDepth);
    return rendered;
  }

  /** Replaces the top screen in place (no depth change), or pushes when empty. */
  replaceScreen(def: UiWidgetDef | unknown): RenderedUiWidget {
    const top = this.screens.at(-1);
    if (!top) return this.pushScreen(def);
    const widget = isUiWidgetDef(def) ? def : normalizeUiWidgetDef(def);
    top.rendered.dispose();
    const rendered = renderUiWidget(widget, { onAction: this.handleAction });
    top.layer.appendChild(rendered.element);
    top.rendered = rendered;
    return rendered;
  }

  /** Pops the top screen. Returns false when the stack was already empty. */
  popScreen(): boolean {
    const entry = this.screens.pop();
    if (!entry) return false;
    entry.rendered.dispose();
    entry.layer.remove();
    this.fireStackChange(this.screens.length + 1);
    return true;
  }

  /** Cancel/back: pops the top screen (alias of {@link popScreen}). */
  back(): boolean {
    return this.popScreen();
  }

  /** Removes every screen (e.g. on resume), firing one stack change. */
  clearScreens(): void {
    if (this.screens.length === 0) return;
    const prevDepth = this.screens.length;
    for (const entry of this.screens) {
      entry.rendered.dispose();
      entry.layer.remove();
    }
    this.screens.length = 0;
    this.fireStackChange(prevDepth);
  }

  /** Element for a node id: searches the top screen first, then the HUD. */
  getElement(nodeId: string): HTMLElement | null {
    return this.screens.at(-1)?.rendered.byId.get(nodeId) ?? this.hud?.byId.get(nodeId) ?? null;
  }

  dispose(): void {
    this.clearScreens();
    this.clearHud();
    this.hudLayer.remove();
    this.screenRoot.remove();
  }

  private readonly handleAction = (action: UiAction, nodeId: string): void => {
    if (action.type === "back") {
      this.back();
      return;
    }
    this.options.onMessageAction?.(action, nodeId);
  };

  private fireStackChange(prevDepth: number): void {
    if (this.screens.length !== prevDepth) {
      this.options.onScreenStackChange?.(this.screens.length);
    }
  }
}

/** Narrow guard: already a normalized {@link UiWidgetDef} (skip re-normalizing). */
function isUiWidgetDef(value: unknown): value is UiWidgetDef {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "ui" &&
    typeof (value as { root?: unknown }).root === "object"
  );
}
