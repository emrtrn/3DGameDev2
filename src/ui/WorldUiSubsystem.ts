/**
 * World-space UI host (UMG Lite "WidgetComponentLite", U7d — Option A).
 *
 * Renders `*.ui.json` widgets as **screen-projected DOM billboards**: each is
 * mounted once into a dedicated `#ui-overlay` layer, then every frame its world
 * anchor is projected to screen pixels and the element is translated/scaled/faded
 * to match (see `engine/ui/uiWorldWidget.ts` for the pure math). Cheap, crisp
 * text, no DOM-to-texture — the real 3D widget mesh (Option B) is deferred.
 *
 * Widgets share the same render/binding/theme/locale plumbing as the screen-space
 * {@link RuntimeUiSubsystem}, so a world label can bind `{ "bind": ... }` fields
 * and resolve `{ "key": ... }` text just like a HUD. Generic by design: the game
 * decides which widgets to place (via the layout) and what their messages mean.
 */
import { renderUiWidget, type RenderedUiWidget, type RenderUiWidgetOptions } from "@engine/ui/uiRenderer";
import { type UiAction, type UiWidgetDef } from "@engine/ui/uiWidget";
import { bindUiLocale, bindUiWidget } from "@engine/ui/uiBinding";
import { applyUiTheme, type UiThemeDef } from "@engine/ui/uiTheme";
import type { UiViewModelStore } from "@engine/ui/uiViewModel";
import type { LocaleRegistry } from "@engine/ui/uiLocale";
import {
  ndcToScreen,
  resolveWorldWidgetVisibility,
  type WorldUiWidget,
} from "@engine/ui/uiWorldWidget";
import { Vector3, type PerspectiveCamera } from "three";

export interface WorldUiSubsystemOptions {
  /** Resolves a world widget's (or Include's) asset id to its normalized def. */
  resolveWidget: (assetId: string) => UiWidgetDef | null;
  /** Resolves a widget's `theme` reference to a loaded theme (for `$token` props). */
  resolveTheme?: (ref: string) => UiThemeDef | null;
  /** ViewModel store driving `{ "bind": "path" }` props; omit for static billboards. */
  store?: UiViewModelStore;
  /** Locale registry resolving `{ "key": ... }` text props; omit for non-localized text. */
  locale?: LocaleRegistry;
  /** Invoked when a `message`-kind widget action fires (UI → gameplay). */
  onMessageAction?: (action: Extract<UiAction, { type: "message" }>, nodeId: string) => void;
}

interface WorldWidgetEntry {
  def: WorldUiWidget;
  /** Cached world anchor (avoids reallocating each frame). */
  anchor: Vector3;
  /** Positioned container the projected transform is written to. */
  wrapper: HTMLElement;
  rendered: RenderedUiWidget;
  /** Releases this widget's data/locale bindings on clear. */
  disposeBinding: () => void;
}

/** Live world-UI state for the `?debug` inspector. */
export interface WorldUiDebugSnapshot {
  /** Mounted world widgets. */
  count: number;
  /** How many are on-screen this frame (in front + within range). */
  visible: number;
}

export class WorldUiSubsystem {
  private readonly layer: HTMLElement;
  private readonly entries: WorldWidgetEntry[] = [];
  /** Scratch vector reused for every projection (no per-frame allocation). */
  private readonly scratch = new Vector3();

  constructor(
    private readonly host: HTMLElement,
    private readonly options: WorldUiSubsystemOptions,
  ) {
    this.layer = document.createElement("div");
    this.layer.className = "forge-ui-world-layer";
    this.host.appendChild(this.layer);
  }

  /** Mounts the given world widgets, replacing any current set. Skips unresolved assets. */
  setWidgets(widgets: WorldUiWidget[]): void {
    this.clear();
    for (const def of widgets) {
      const widgetDef = this.options.resolveWidget(def.widget);
      if (!widgetDef) continue; // unresolved asset id → skip (the scene still plays)
      const wrapper = document.createElement("div");
      wrapper.className = "forge-ui-world-item";
      wrapper.style.display = "none"; // hidden until the first projection places it
      const rendered = renderUiWidget(widgetDef, this.renderOptions());
      wrapper.appendChild(rendered.element);
      this.applyTheme(rendered, widgetDef);
      this.layer.appendChild(wrapper);
      this.entries.push({
        def,
        anchor: new Vector3(def.anchor.worldPos[0], def.anchor.worldPos[1], def.anchor.worldPos[2]),
        wrapper,
        rendered,
        disposeBinding: this.bind(rendered, widgetDef),
      });
    }
  }

  /**
   * Projects each widget's anchor through the camera and positions its element.
   * Anchors behind the camera or past `maxDistance` are hidden; the rest get a
   * pixel translate (anchor + offset, centered), a perspective scale and a fade.
   * Call once per frame with the live camera + viewport pixel size.
   */
  update(camera: PerspectiveCamera, width: number, height: number): void {
    if (this.entries.length === 0 || width <= 0 || height <= 0) return;
    for (const entry of this.entries) {
      this.scratch.copy(entry.anchor);
      const distance = camera.position.distanceTo(this.scratch);
      this.scratch.project(camera);
      const proj = ndcToScreen(this.scratch.x, this.scratch.y, this.scratch.z, width, height);
      const visibility = resolveWorldWidgetVisibility(
        distance,
        entry.def.maxDistance !== undefined ? { maxDistance: entry.def.maxDistance } : {},
      );
      if (!proj.inFront || !visibility.visible) {
        entry.wrapper.style.display = "none";
        continue;
      }
      const offsetX = entry.def.offset?.[0] ?? 0;
      const offsetY = entry.def.offset?.[1] ?? 0;
      entry.wrapper.style.display = "";
      entry.wrapper.style.opacity = visibility.opacity.toFixed(3);
      entry.wrapper.style.transform =
        `translate(${(proj.x + offsetX).toFixed(1)}px, ${(proj.y + offsetY).toFixed(1)}px) ` +
        `translate(-50%, -50%) scale(${visibility.scale.toFixed(3)})`;
    }
  }

  /** Mounted + currently-visible counts for the `?debug` inspector. */
  getDebugSnapshot(): WorldUiDebugSnapshot {
    let visible = 0;
    for (const entry of this.entries) {
      if (entry.wrapper.style.display !== "none") visible += 1;
    }
    return { count: this.entries.length, visible };
  }

  dispose(): void {
    this.clear();
    this.layer.remove();
  }

  private clear(): void {
    for (const entry of this.entries) {
      entry.disposeBinding();
      entry.rendered.dispose();
      entry.wrapper.remove();
    }
    this.entries.length = 0;
  }

  /** A `message` action is forwarded out; `back` is a no-op (no screen stack here). */
  private readonly handleAction = (action: UiAction, nodeId: string): void => {
    if (action.type === "message") this.options.onMessageAction?.(action, nodeId);
  };

  private renderOptions(): RenderUiWidgetOptions {
    const opts: RenderUiWidgetOptions = {
      onAction: this.handleAction,
      resolveWidget: this.options.resolveWidget,
    };
    const locale = this.options.locale;
    if (locale) opts.resolveLoc = (key, params) => locale.resolve(key, params);
    return opts;
  }

  /** Wires a freshly rendered widget to the store + locale registry (combined dispose). */
  private bind(rendered: RenderedUiWidget, widget: UiWidgetDef): () => void {
    const disposers: (() => void)[] = [];
    if (this.options.store) disposers.push(bindUiWidget(rendered, widget, this.options.store));
    if (this.options.locale) disposers.push(bindUiLocale(rendered, widget, this.options.locale));
    if (disposers.length === 0) return () => {};
    return () => {
      for (const dispose of disposers) dispose();
    };
  }

  private applyTheme(rendered: RenderedUiWidget, widget: UiWidgetDef): void {
    if (!widget.theme || !this.options.resolveTheme) return;
    const theme = this.options.resolveTheme(widget.theme);
    if (theme) applyUiTheme(rendered.element, theme);
  }
}
