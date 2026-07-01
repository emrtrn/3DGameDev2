/**
 * DialogueSubsystem — resolves and plays authored dialogue lines, and drives
 * subtitle events. Separate from the {@link AudioSubsystem}: it owns the "who is
 * speaking, what recorded line/subtitle should play, and when does it end" logic,
 * and delegates the actual sound to an injected {@link DialogueAudioPlayer} so the
 * engine layer stays free of Web Audio / cue-graph knowledge.
 *
 * Playback is time-driven and deterministic: each active line carries a remaining
 * display timer that `update()` decrements by `deltaSeconds`, so headless tests
 * can advance dialogue with fixed steps and no Web Audio context. When a line has
 * no recorded audio the subtitle duration is estimated from its text length
 * (`estimateSubtitleDurationSeconds`).
 */
import type { EngineUpdateContext, Subsystem } from "../core/Subsystem";
import {
  estimateSubtitleDurationSeconds,
  resolveDialogueLine,
  type DialogueLocalizationSource,
  type ResolvedDialogueLine,
} from "./dialogueResolver";
import type {
  DialogueAudioSourceType,
  DialogueLineAsset,
  DialoguePlayContext,
  DialogueVoiceAsset,
} from "./dialogueTypes";

export const DIALOGUE_SUBSYSTEM_ID = "dialogue";

/** A request handed to the host so it can play a resolved line's audio. */
export interface DialogueAudioRequest {
  lineId: string;
  sourceId: string;
  sourceType: DialogueAudioSourceType;
}

/** Host-owned control over an in-flight dialogue audio play. */
export interface DialogueAudioPlayback {
  stop(): void;
  /** Known duration in seconds, if the source can report one (else estimate). */
  durationSeconds?: number;
}

/**
 * Plays a resolved line's audio. Returns a control handle, or null when nothing
 * could be played (missing source, muted host, etc.). Injected by the runtime.
 */
export type DialogueAudioPlayer = (request: DialogueAudioRequest) => DialogueAudioPlayback | null;

/** Emitted when a line's subtitle should appear on screen. */
export interface DialogueSubtitleEvent {
  lineId: string;
  text: string;
  speakerVoiceId?: string;
  /** Resolved speaker display name (from the voice asset), if known. */
  speakerName?: string;
  mature: boolean;
  durationSeconds: number;
}

export interface DialogueLineStartInfo {
  lineId: string;
  resolved: ResolvedDialogueLine;
  hasAudio: boolean;
  durationSeconds: number;
}

export interface DialogueLineEndInfo {
  lineId: string;
  /** True when the line was cut short by `stopLine`/`stopAll` rather than timing out. */
  interrupted: boolean;
}

export interface DialoguePlayResult {
  played: boolean;
  resolved?: ResolvedDialogueLine;
  hasAudio: boolean;
  durationSeconds: number;
}

export interface DialogueSubsystemOptions {
  voices?: Iterable<DialogueVoiceAsset>;
  lines?: Iterable<DialogueLineAsset>;
  playAudio?: DialogueAudioPlayer;
  /** Per-locale subtitle/recording lookup (D4); absent = authored text/audio only. */
  localization?: DialogueLocalizationSource;
  onSubtitleShow?: (event: DialogueSubtitleEvent) => void;
  onSubtitleHide?: (lineId: string) => void;
  onLineStart?: (info: DialogueLineStartInfo) => void;
  onLineEnd?: (info: DialogueLineEndInfo) => void;
}

interface ActiveLine {
  lineId: string;
  remaining: number;
  playback: DialogueAudioPlayback | null;
}

export class DialogueSubsystem implements Subsystem {
  readonly id = DIALOGUE_SUBSYSTEM_ID;
  private readonly voices = new Map<string, DialogueVoiceAsset>();
  private readonly lines = new Map<string, DialogueLineAsset>();
  private readonly active = new Map<string, ActiveLine>();
  private playAudio?: DialogueAudioPlayer;
  private localization: DialogueLocalizationSource | undefined = undefined;
  private onSubtitleShow?: (event: DialogueSubtitleEvent) => void;
  private onSubtitleHide?: (lineId: string) => void;
  private onLineStart?: (info: DialogueLineStartInfo) => void;
  private onLineEnd?: (info: DialogueLineEndInfo) => void;

  constructor(options: DialogueSubsystemOptions = {}) {
    for (const voice of options.voices ?? []) this.registerVoice(voice);
    for (const line of options.lines ?? []) this.registerLine(line);
    if (options.playAudio) this.playAudio = options.playAudio;
    if (options.localization) this.localization = options.localization;
    if (options.onSubtitleShow) this.onSubtitleShow = options.onSubtitleShow;
    if (options.onSubtitleHide) this.onSubtitleHide = options.onSubtitleHide;
    if (options.onLineStart) this.onLineStart = options.onLineStart;
    if (options.onLineEnd) this.onLineEnd = options.onLineEnd;
  }

  registerVoice(voice: DialogueVoiceAsset): void {
    this.voices.set(voice.id, voice);
  }

  registerLine(line: DialogueLineAsset): void {
    this.lines.set(line.id, line);
  }

  /** Sets (or clears) the per-locale subtitle/recording lookup used by `playLine`. */
  setLocalization(localization: DialogueLocalizationSource | undefined): void {
    this.localization = localization;
  }

  getVoice(id: string): DialogueVoiceAsset | undefined {
    return this.voices.get(id);
  }

  getLine(id: string): DialogueLineAsset | undefined {
    return this.lines.get(id);
  }

  /** Line ids with a subtitle currently on screen (debug/inspection). */
  activeLineIds(): string[] {
    return [...this.active.keys()];
  }

  /**
   * Resolves a line for the given context, plays its audio (if any), and shows
   * its subtitle. Replaying a line that is already active restarts it. Returns
   * whether anything played and the resolved line/duration.
   */
  playLine(lineId: string, context: DialoguePlayContext = {}): DialoguePlayResult {
    const line = this.lines.get(lineId);
    if (!line) return { played: false, hasAudio: false, durationSeconds: 0 };

    const resolved = resolveDialogueLine(line, context, this.localization);

    // Restart an already-active line without firing its end callbacks.
    const existing = this.active.get(lineId);
    if (existing) {
      existing.playback?.stop();
      this.active.delete(lineId);
    }

    let playback: DialogueAudioPlayback | null = null;
    if (resolved.audioSourceId && this.playAudio) {
      playback = this.playAudio({
        lineId,
        sourceId: resolved.audioSourceId,
        sourceType: resolved.audioSourceType,
      });
    }

    const audioDuration = playback?.durationSeconds;
    const durationSeconds =
      typeof audioDuration === "number" && audioDuration > 0
        ? audioDuration
        : estimateSubtitleDurationSeconds(resolved.subtitleText);

    this.active.set(lineId, { lineId, remaining: durationSeconds, playback });

    const voice = resolved.speakerVoiceId ? this.voices.get(resolved.speakerVoiceId) : undefined;
    const event: DialogueSubtitleEvent = {
      lineId,
      text: resolved.subtitleText,
      mature: resolved.mature,
      durationSeconds,
    };
    if (resolved.speakerVoiceId) event.speakerVoiceId = resolved.speakerVoiceId;
    const speakerName = voice?.displayName ?? voice?.name;
    if (speakerName) event.speakerName = speakerName;

    this.onLineStart?.({ lineId, resolved, hasAudio: Boolean(playback), durationSeconds });
    this.onSubtitleShow?.(event);
    return { played: true, resolved, hasAudio: Boolean(playback), durationSeconds };
  }

  /** Stops a specific active line (hides its subtitle, stops its audio). */
  stopLine(lineId: string): void {
    const state = this.active.get(lineId);
    if (!state) return;
    state.playback?.stop();
    this.active.delete(lineId);
    this.onSubtitleHide?.(lineId);
    this.onLineEnd?.({ lineId, interrupted: true });
  }

  /** Stops every active line (scene teardown / skip-all). */
  stopAll(): void {
    for (const lineId of [...this.active.keys()]) this.stopLine(lineId);
  }

  update(context: EngineUpdateContext): void {
    if (this.active.size === 0) return;
    const dt = context.deltaSeconds;
    if (!(dt > 0)) return;
    for (const state of [...this.active.values()]) {
      state.remaining -= dt;
      if (state.remaining <= 0) this.finishLine(state.lineId);
    }
  }

  dispose(): void {
    this.stopAll();
    this.voices.clear();
    this.lines.clear();
  }

  /** A line whose display timer elapsed naturally: hide subtitle, fire end. */
  private finishLine(lineId: string): void {
    if (!this.active.delete(lineId)) return;
    this.onSubtitleHide?.(lineId);
    this.onLineEnd?.({ lineId, interrupted: false });
  }
}
