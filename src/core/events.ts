/**
 * Minimal typed event bus — the only bridge between game-logic modules
 * (M1–M9, pure TS) and the render layer (src/scene/).
 *
 * Architecture rule (L11 / CLAUDE.md): game-logic modules NEVER import
 * three.js; the scene layer subscribes to their events here and renders
 * state. Nothing in src/core/ may import from src/scene/.
 *
 * The event map starts empty on purpose: each mechanic module (M1–M9)
 * will extend it when implemented. Unreal bridge: think of this as a
 * lightweight, code-only Event Dispatcher — no engine delegate types.
 */
export type EventMap = Record<string, unknown>;

type Listener<T> = (payload: T) => void;

export class EventBus<E extends EventMap> {
  private listeners = new Map<keyof E, Set<Listener<never>>>();

  on<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  off<K extends keyof E>(event: K, listener: Listener<E[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<E[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
