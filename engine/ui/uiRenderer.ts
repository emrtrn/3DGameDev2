/**
 * UI Widget renderer (UMG Lite runtime).
 *
 * Two layers, split so the mapping logic is testable without a DOM:
 *   1. {@link buildUiRenderTree} — pure: turns a {@link UiWidgetDef} into a plain
 *      {@link UiRenderNode} tree (tag + class + CSS style + text + action). No
 *      DOM, no Three; unit-tested in `tools/engine-tests.ts`.
 *   2. {@link renderUiWidget} / {@link mountUiRenderNode} — thin: walks that tree
 *      into real elements under `#ui-overlay`, wiring action listeners and an
 *      id→element map. Touches `document` only when called (safe to import in
 *      node).
 *
 * v1 widget set: Canvas, Panel, Stack, Text, Image, Button, ProgressBar.
 */
import {
  isUiContainerKind,
  readUiAction,
  readUiStaticNumber,
  readUiStaticString,
  type UiAction,
  type UiNode,
  type UiWidgetDef,
  type UiWidgetKind,
} from "./uiWidget";

/** Stable CSS suffix per widget kind (`Forge-ui-<suffix>`), decoupled from the enum casing. */
const WIDGET_CSS_NAME: Record<UiWidgetKind, string> = {
  Canvas: "canvas",
  Panel: "panel",
  Stack: "stack",
  Text: "text",
  Image: "image",
  Button: "button",
  ProgressBar: "progress",
};

/** Plain, DOM-free description of one rendered element (the renderer's IR). */
export interface UiRenderNode {
  /** Authored {@link UiNode.id}; absent (empty) for synthetic nodes (e.g. progress fill). */
  nodeId: string;
  widget: UiWidgetKind | "ProgressFill";
  tag: "div" | "button";
  className: string;
  /** CSS-named inline style props (e.g. `align-items`, `border-radius`). */
  style: Record<string, string>;
  /** Text content for leaf nodes (Text/Button); undefined for containers. */
  text?: string;
  /** Click action for interactive nodes (Button). */
  action?: UiAction;
  /** Synthetic nodes are not authored: skipped from the id→element map + data id. */
  synthetic?: boolean;
  children: UiRenderNode[];
}

/** Layout/style props mapped onto inline CSS (allowlisted so `style` can't be arbitrary CSS). */
const STYLE_NUMBER_PX: Record<string, string> = {
  gap: "gap",
  padding: "padding",
  width: "width",
  height: "height",
  minWidth: "min-width",
  minHeight: "min-height",
  maxWidth: "max-width",
  maxHeight: "max-height",
  fontSize: "font-size",
  radius: "border-radius",
};
const STYLE_NUMBER_RAW: Record<string, string> = {
  grow: "flex-grow",
  opacity: "opacity",
};
const STYLE_STRING_RAW: Record<string, string> = {
  background: "background",
  color: "color",
  fontWeight: "font-weight",
};

/** Friendly flex alignment tokens → CSS values (passthrough for anything else). */
const FLEX_ALIGN: Record<string, string> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  stretch: "stretch",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

function flexValue(token: string): string {
  return FLEX_ALIGN[token] ?? token;
}

/** Resolves a node's allowlisted style props into a CSS-named inline-style map. */
export function resolveInlineStyle(node: UiNode): Record<string, string> {
  const style: Record<string, string> = {};
  const align = readUiStaticString(node, "align");
  if (align) style["align-items"] = flexValue(align);
  const justify = readUiStaticString(node, "justify");
  if (justify) style["justify-content"] = flexValue(justify);
  for (const [key, css] of Object.entries(STYLE_NUMBER_PX)) {
    const value = readUiStaticNumber(node, key);
    if (value !== undefined) style[css] = `${value}px`;
  }
  for (const [key, css] of Object.entries(STYLE_NUMBER_RAW)) {
    const value = readUiStaticNumber(node, key);
    if (value !== undefined) style[css] = String(value);
  }
  for (const [key, css] of Object.entries(STYLE_STRING_RAW)) {
    const value = readUiStaticString(node, key);
    if (value !== undefined) style[css] = value;
  }
  return style;
}

function progressFillNode(node: UiNode): UiRenderNode {
  const value = readUiStaticNumber(node, "value") ?? 0;
  const max = readUiStaticNumber(node, "max") ?? 1;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return {
    nodeId: "",
    widget: "ProgressFill",
    tag: "div",
    className: "forge-ui-progress__fill",
    style: { width: `${(pct * 100).toFixed(2)}%` },
    synthetic: true,
    children: [],
  };
}

/** Builds the className for a node: base + per-kind + Stack direction + interactive opt-in. */
function classNameFor(node: UiNode): string {
  const classes = ["forge-ui-node", `forge-ui-${WIDGET_CSS_NAME[node.widget]}`];
  if (node.widget === "Stack") {
    const direction = readUiStaticString(node, "direction") === "row" ? "row" : "column";
    classes.push(`forge-ui-stack--${direction}`);
  }
  // Interactive widgets opt back into pointer events (the overlay root is click-through).
  if (node.widget === "Button") classes.push("ui-interactive");
  return classes.join(" ");
}

/** Pure: maps one authored {@link UiNode} into a {@link UiRenderNode}. */
export function buildUiRenderNode(node: UiNode): UiRenderNode {
  const style = resolveInlineStyle(node);
  const className = classNameFor(node);

  if (node.widget === "Image") {
    const src = readUiStaticString(node, "src");
    if (src) style["background-image"] = `url(${JSON.stringify(src)})`;
    return { nodeId: node.id, widget: "Image", tag: "div", className, style, children: [] };
  }

  if (node.widget === "Text") {
    return {
      nodeId: node.id,
      widget: "Text",
      tag: "div",
      className,
      style,
      text: readUiStaticString(node, "text") ?? "",
      children: [],
    };
  }

  if (node.widget === "Button") {
    const action = readUiAction(node);
    return {
      nodeId: node.id,
      widget: "Button",
      tag: "button",
      className,
      style,
      text: readUiStaticString(node, "text") ?? "Button",
      ...(action ? { action } : {}),
      children: [],
    };
  }

  if (node.widget === "ProgressBar") {
    return {
      nodeId: node.id,
      widget: "ProgressBar",
      tag: "div",
      className,
      style,
      children: [progressFillNode(node)],
    };
  }

  // Containers (Canvas/Panel/Stack): recurse children.
  const children = isUiContainerKind(node.widget) ? node.children.map(buildUiRenderNode) : [];
  return { nodeId: node.id, widget: node.widget, tag: "div", className, style, children };
}

/** Pure: builds the full render tree for an asset (its root node). */
export function buildUiRenderTree(def: UiWidgetDef): UiRenderNode {
  return buildUiRenderNode(def.root);
}

export interface UiMountContext {
  onAction?: ((action: UiAction, nodeId: string) => void) | undefined;
  /** Filled with authored-node id → element (synthetic nodes excluded). */
  byId: Map<string, HTMLElement>;
}

/** Thin DOM layer: materializes one {@link UiRenderNode} (and its subtree). */
export function mountUiRenderNode(node: UiRenderNode, ctx: UiMountContext): HTMLElement {
  const element = document.createElement(node.tag);
  element.className = node.className;
  for (const [css, value] of Object.entries(node.style)) {
    element.style.setProperty(css, value);
  }
  if (!node.synthetic && node.nodeId) element.dataset.uiId = node.nodeId;
  if (node.text !== undefined && node.children.length === 0) {
    element.textContent = node.text;
  }
  for (const child of node.children) {
    element.appendChild(mountUiRenderNode(child, ctx));
  }
  if (node.action && ctx.onAction) {
    const action = node.action;
    element.addEventListener("click", () => ctx.onAction?.(action, node.nodeId));
  }
  if (!node.synthetic && node.nodeId) ctx.byId.set(node.nodeId, element);
  return element;
}

export interface RenderedUiWidget {
  /** Root element (mount it under `#ui-overlay`). */
  element: HTMLElement;
  /** Authored-node id → element, for binding updates / inspection. */
  byId: Map<string, HTMLElement>;
  /** The pure render tree the element was built from. */
  tree: UiRenderNode;
  /** Removes the element from the DOM (listeners GC with it). */
  dispose(): void;
}

export interface RenderUiWidgetOptions {
  onAction?: (action: UiAction, nodeId: string) => void;
}

/** Builds + mounts a widget asset into a detached element ready to append to the overlay. */
export function renderUiWidget(
  def: UiWidgetDef,
  options: RenderUiWidgetOptions = {},
): RenderedUiWidget {
  const tree = buildUiRenderTree(def);
  const byId = new Map<string, HTMLElement>();
  const element = mountUiRenderNode(tree, { onAction: options.onAction, byId });
  return {
    element,
    byId,
    tree,
    dispose: () => element.remove(),
  };
}
