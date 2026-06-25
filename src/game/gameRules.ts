/**
 * Pure gameplay-rules core (minimal, generic Game Framework v0).
 *
 * Unreal's GameMode owns *possession/spawn*; this is the missing *rules* layer
 * (Unreal's GameState/GameMode scoring analogue): named score/life variables,
 * collect-N objectives, an optional round timer, and declarative win/lose
 * conditions that resolve a {@link GamePhase}. It is fully data-driven — the
 * template ships no rules; a concrete game authors a {@link GameRulesConfig} and
 * the runtime drives this store from gameplay events (triggers, actor scripts).
 *
 * Headless and deterministic: no Three, no DOM, no engine imports. The runtime
 * shell (`src/scene/RuntimeSceneApp.ts`) owns one {@link GameStateStore}, feeds
 * it {@link GameEvent}s + `tick(dt)`, mirrors {@link GameStateStore.hudFields}
 * into the UI ViewModel store, and reacts to phase changes (win/lose screen).
 */

/** A named scalar the rules track (score, lives, coins, …). */
export interface GameVariableDef {
  readonly id: string;
  readonly initial: number;
  /** Optional HUD label prefix the game's widget may bind to (`game.var.<id>.label`). */
  readonly label?: string;
}

/** A "collect/reach N" objective. Completes when `count >= target`. */
export interface GameObjectiveDef {
  readonly id: string;
  readonly label: string;
  /** Count required to complete (clamped to >= 1). */
  readonly target: number;
  /** Starting count (default 0, clamped to `[0, target]`). */
  readonly initial?: number;
  /** Optional objectives don't gate the objectives-complete win condition. */
  readonly optional?: boolean;
}

export type GameOutcome = "win" | "lose";
export type GameTimerDirection = "up" | "down";

/**
 * A round timer. `down` counts from `durationSeconds` to 0 then resolves
 * `onExpire` (default `lose`); `up` is a stopwatch with no auto-expiry.
 */
export interface GameTimerDef {
  readonly durationSeconds: number;
  readonly direction?: GameTimerDirection;
  readonly onExpire?: GameOutcome;
}

/** The data a concrete game authors to activate the rules layer. */
export interface GameRulesConfig {
  readonly variables?: readonly GameVariableDef[];
  readonly objectives?: readonly GameObjectiveDef[];
  readonly timer?: GameTimerDef;
  /** Win when every required objective completes. Default: true iff objectives exist. */
  readonly winWhenObjectivesComplete?: boolean;
  /** Lose when this variable's value reaches <= 0 (e.g. `"lives"`). */
  readonly loseWhenVariableDepleted?: string;
}

export type GamePhase = "playing" | "won" | "lost";

/**
 * A gameplay event the runtime feeds the store. Variable/objective events that
 * name an id the config never declared are ignored (stale content is harmless).
 */
export type GameEvent =
  | { readonly kind: "add"; readonly variable: string; readonly amount: number }
  | { readonly kind: "set"; readonly variable: string; readonly value: number }
  | { readonly kind: "objective"; readonly id: string; readonly amount?: number }
  | { readonly kind: "objective-set"; readonly id: string; readonly count: number }
  | { readonly kind: "win" }
  | { readonly kind: "lose" }
  | { readonly kind: "restart" };

/** Read-only objective view for debug/tests. */
export interface ObjectiveSnapshot {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly target: number;
  readonly complete: boolean;
  readonly optional: boolean;
}

/** Read-only state view for debug/tests. */
export interface GameStateSnapshot {
  readonly phase: GamePhase;
  readonly elapsedSeconds: number;
  readonly variables: Readonly<Record<string, number>>;
  readonly objectives: readonly ObjectiveSnapshot[];
  readonly timerSeconds: number | null;
}

/** Flat `path -> value` map the runtime mirrors into the UI ViewModel store. */
export type GameHudFields = Record<string, string | number | boolean>;

// --- Normalization ---------------------------------------------------------

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeVariable(raw: unknown): GameVariableDef | null {
  const obj = asObject(raw);
  const id = obj ? str(obj.id) : null;
  if (!obj || !id) return null;
  const label = str(obj.label);
  return { id, initial: num(obj.initial, 0), ...(label ? { label } : {}) };
}

function normalizeObjective(raw: unknown): GameObjectiveDef | null {
  const obj = asObject(raw);
  const id = obj ? str(obj.id) : null;
  if (!obj || !id) return null;
  const target = Math.max(1, Math.floor(num(obj.target, 1)));
  const initial = Math.min(target, Math.max(0, Math.floor(num(obj.initial, 0))));
  return {
    id,
    label: str(obj.label) ?? id,
    target,
    ...(initial > 0 ? { initial } : {}),
    ...(obj.optional === true ? { optional: true } : {}),
  };
}

function normalizeTimer(raw: unknown): GameTimerDef | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const durationSeconds = num(obj.durationSeconds, 0);
  if (durationSeconds <= 0) return null;
  const direction: GameTimerDirection = obj.direction === "up" ? "up" : "down";
  const onExpire: GameOutcome | undefined =
    obj.onExpire === "win" ? "win" : obj.onExpire === "lose" ? "lose" : undefined;
  return { durationSeconds, direction, ...(onExpire ? { onExpire } : {}) };
}

/**
 * Validates/clamps raw config (e.g. from `worldSettings.gameRules`). Returns
 * null when there is nothing to drive (no variables, objectives, or timer), so
 * the template — and any scene without rules — pays nothing and stays dormant.
 * Duplicate ids keep the first occurrence.
 */
export function normalizeGameRules(raw: unknown): GameRulesConfig | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const variables: GameVariableDef[] = [];
  const seenVars = new Set<string>();
  for (const entry of Array.isArray(obj.variables) ? obj.variables : []) {
    const v = normalizeVariable(entry);
    if (v && !seenVars.has(v.id)) {
      seenVars.add(v.id);
      variables.push(v);
    }
  }

  const objectives: GameObjectiveDef[] = [];
  const seenObj = new Set<string>();
  for (const entry of Array.isArray(obj.objectives) ? obj.objectives : []) {
    const o = normalizeObjective(entry);
    if (o && !seenObj.has(o.id)) {
      seenObj.add(o.id);
      objectives.push(o);
    }
  }

  const timer = normalizeTimer(obj.timer);
  if (variables.length === 0 && objectives.length === 0 && !timer) return null;

  const loseWhenVariableDepleted = str(obj.loseWhenVariableDepleted);
  const winWhenObjectivesComplete =
    typeof obj.winWhenObjectivesComplete === "boolean"
      ? obj.winWhenObjectivesComplete
      : objectives.length > 0;

  return {
    ...(variables.length > 0 ? { variables } : {}),
    ...(objectives.length > 0 ? { objectives } : {}),
    ...(timer ? { timer } : {}),
    winWhenObjectivesComplete,
    ...(loseWhenVariableDepleted ? { loseWhenVariableDepleted } : {}),
  };
}

/**
 * Maps a loose runtime payload (a `game-event` script message) to a
 * {@link GameEvent}, or null when it names no recognizable event. Keeps the
 * shell's event wiring thin and unit-testable.
 */
export function parseGameEvent(raw: unknown): GameEvent | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const kind = str(obj.event) ?? str(obj.kind);
  switch (kind) {
    case "add": {
      const variable = str(obj.variable);
      return variable ? { kind: "add", variable, amount: num(obj.amount, 1) } : null;
    }
    case "set": {
      const variable = str(obj.variable);
      return variable ? { kind: "set", variable, value: num(obj.value, 0) } : null;
    }
    case "objective": {
      const id = str(obj.id);
      if (!id) return null;
      return typeof obj.amount === "number"
        ? { kind: "objective", id, amount: num(obj.amount, 1) }
        : { kind: "objective", id };
    }
    case "objective-set": {
      const id = str(obj.id);
      return id ? { kind: "objective-set", id, count: num(obj.count, 0) } : null;
    }
    case "win":
      return { kind: "win" };
    case "lose":
      return { kind: "lose" };
    case "restart":
      return { kind: "restart" };
    default:
      return null;
  }
}

// --- Runtime store ---------------------------------------------------------

interface ObjectiveState {
  readonly def: GameObjectiveDef;
  count: number;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/** Formats whole seconds as `mm:ss` for HUD timer labels. */
export function formatTimer(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(whole / 60))}:${pad2(whole % 60)}`;
}

/**
 * The live, mutable rules state for one Play session. Construct from a
 * normalized config; drive with {@link dispatch} (events) and {@link tick}
 * (time). Win/lose is re-evaluated after every mutation; the first terminal
 * phase sticks until {@link reset}. Pause is external: the shell simply stops
 * calling {@link tick}/{@link dispatch} while paused.
 */
export class GameStateStore {
  private readonly variables = new Map<string, number>();
  private readonly objectives = new Map<string, ObjectiveState>();
  private readonly timer: GameTimerDef | null;
  private readonly winOnObjectives: boolean;
  private readonly loseVariable: string | null;
  private phaseInternal: GamePhase = "playing";
  private elapsed = 0;

  constructor(private readonly config: GameRulesConfig) {
    this.timer = config.timer ?? null;
    this.winOnObjectives = config.winWhenObjectivesComplete ?? false;
    this.loseVariable = config.loseWhenVariableDepleted ?? null;
    this.reset();
  }

  get phase(): GamePhase {
    return this.phaseInternal;
  }

  get elapsedSeconds(): number {
    return this.elapsed;
  }

  /** Current value of a declared variable, or undefined when not declared. */
  variable(id: string): number | undefined {
    return this.variables.get(id);
  }

  /** Remaining (down) / elapsed (up) timer seconds, or null when no timer. */
  timerSeconds(): number | null {
    if (!this.timer) return null;
    if (this.timer.direction === "up") return this.elapsed;
    return Math.max(0, this.timer.durationSeconds - this.elapsed);
  }

  /** Restores variables/objectives/timer/phase to their authored initial state. */
  reset(): void {
    this.variables.clear();
    for (const v of this.config.variables ?? []) this.variables.set(v.id, v.initial);
    this.objectives.clear();
    for (const def of this.config.objectives ?? []) {
      this.objectives.set(def.id, { def, count: def.initial ?? 0 });
    }
    this.phaseInternal = "playing";
    this.elapsed = 0;
    this.checkConditions();
  }

  /** Applies one event, then re-evaluates win/lose. Ignored once terminal (except restart). */
  dispatch(event: GameEvent): void {
    if (event.kind === "restart") {
      this.reset();
      return;
    }
    if (this.phaseInternal !== "playing") return;
    switch (event.kind) {
      case "add": {
        if (this.variables.has(event.variable)) {
          this.variables.set(event.variable, (this.variables.get(event.variable) ?? 0) + event.amount);
        }
        break;
      }
      case "set": {
        if (this.variables.has(event.variable)) this.variables.set(event.variable, event.value);
        break;
      }
      case "objective": {
        const obj = this.objectives.get(event.id);
        if (obj) obj.count = Math.min(obj.def.target, obj.count + (event.amount ?? 1));
        break;
      }
      case "objective-set": {
        const obj = this.objectives.get(event.id);
        if (obj) obj.count = Math.max(0, Math.min(obj.def.target, Math.floor(event.count)));
        break;
      }
      case "win":
        this.setPhase("won");
        return;
      case "lose":
        this.setPhase("lost");
        return;
    }
    this.checkConditions();
  }

  /** Advances the timer and re-evaluates win/lose. No-op once terminal. */
  tick(deltaSeconds: number): void {
    if (this.phaseInternal !== "playing") return;
    this.elapsed += Math.max(0, deltaSeconds);
    if (this.timer && this.timer.direction === "down" && this.timerSeconds() === 0) {
      this.setPhase((this.timer.onExpire ?? "lose") === "win" ? "won" : "lost");
      return;
    }
    this.checkConditions();
  }

  /** Structured snapshot for the `?debug` overlay and tests. */
  snapshot(): GameStateSnapshot {
    const variables: Record<string, number> = {};
    for (const [id, value] of this.variables) variables[id] = value;
    return {
      phase: this.phaseInternal,
      elapsedSeconds: this.elapsed,
      variables,
      objectives: [...this.objectives.values()].map((o) => this.objectiveSnapshot(o)),
      timerSeconds: this.timerSeconds(),
    };
  }

  /**
   * Flat ViewModel fields the HUD binds to. Namespaced under `game.*`:
   * `game.phase`, `game.var.<id>`, `game.objective.<id>.{count,target,complete,label}`,
   * `game.objectivesComplete`/`game.objectivesTotal`, `game.timer.{seconds,label}`.
   */
  hudFields(): GameHudFields {
    const fields: GameHudFields = { "game.phase": this.phaseInternal };
    for (const v of this.config.variables ?? []) {
      fields[`game.var.${v.id}`] = this.variables.get(v.id) ?? 0;
      if (v.label) fields[`game.var.${v.id}.label`] = v.label;
    }
    let requiredTotal = 0;
    let requiredComplete = 0;
    for (const o of this.objectives.values()) {
      const complete = this.isComplete(o);
      fields[`game.objective.${o.def.id}.count`] = o.count;
      fields[`game.objective.${o.def.id}.target`] = o.def.target;
      fields[`game.objective.${o.def.id}.complete`] = complete;
      fields[`game.objective.${o.def.id}.label`] = o.def.label;
      if (!o.def.optional) {
        requiredTotal += 1;
        if (complete) requiredComplete += 1;
      }
    }
    fields["game.objectivesComplete"] = requiredComplete;
    fields["game.objectivesTotal"] = requiredTotal;
    const timerSeconds = this.timerSeconds();
    if (timerSeconds !== null) {
      fields["game.timer.seconds"] = Math.max(0, Math.floor(timerSeconds));
      fields["game.timer.label"] = formatTimer(timerSeconds);
    }
    return fields;
  }

  private objectiveSnapshot(o: ObjectiveState): ObjectiveSnapshot {
    return {
      id: o.def.id,
      label: o.def.label,
      count: o.count,
      target: o.def.target,
      complete: this.isComplete(o),
      optional: o.def.optional ?? false,
    };
  }

  private isComplete(o: ObjectiveState): boolean {
    return o.count >= o.def.target;
  }

  private setPhase(phase: GamePhase): void {
    // First terminal phase wins; a settled round only changes via reset().
    if (this.phaseInternal === "playing") this.phaseInternal = phase;
  }

  /** Lose conditions take precedence over win on the same evaluation. */
  private checkConditions(): void {
    if (this.phaseInternal !== "playing") return;
    if (this.loseVariable && (this.variables.get(this.loseVariable) ?? 0) <= 0) {
      this.setPhase("lost");
      return;
    }
    if (this.winOnObjectives && this.allRequiredComplete()) this.setPhase("won");
  }

  private allRequiredComplete(): boolean {
    let required = 0;
    for (const o of this.objectives.values()) {
      if (o.def.optional) continue;
      required += 1;
      if (!this.isComplete(o)) return false;
    }
    return required > 0;
  }
}
