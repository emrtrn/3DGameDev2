import type { EngineUpdateContext, Subsystem } from "../core/Subsystem";
import {
  DEFAULT_AUDIO_CLIP_MANIFEST,
  audioClipById,
  type AudioClipManifest,
} from "../assets/audio";

export const AUDIO_SUBSYSTEM_ID = "audio";
export type AudioBackend = "none" | "web-audio";

export interface AudioPlayOptions {
  volume?: number;
  loop?: boolean;
  spatial?: boolean;
  pitch?: number;
}

export interface AudioPlayRequest extends AudioPlayOptions {
  clipId: string;
}

export interface AudioPlaybackHandle {
  readonly clipId: string;
  readonly stopped: boolean;
  readonly volume: number;
  readonly pitch: number;
  stop(fadeSeconds?: number): void;
  setVolume(value: number, fadeSeconds?: number): void;
  setPitch(value: number): void;
}

export interface AudioBus {
  playOneShot(clipId: string, options?: AudioPlayOptions): void;
  play(clipId: string, options?: AudioPlayOptions): AudioPlaybackHandle;
}

export interface AudioSubsystemOptions {
  backend?: AudioBackend;
  clips?: AudioClipManifest;
  /**
   * Resolves a `clipId` that is not a built-in tone clip to a fetchable audio
   * file URL (e.g. a manifest `sound` asset). Returning null skips playback.
   * Injected by the host so the engine layer stays manifest-agnostic.
   */
  resolveClipUrl?: (clipId: string) => string | null;
}

type BrowserAudioContext = AudioContext;

type AudioSourceNode = AudioBufferSourceNode | OscillatorNode;

class RuntimeAudioPlaybackHandle implements AudioPlaybackHandle {
  readonly clipId: string;
  private source: AudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private context: BrowserAudioContext | null = null;
  private sourceBaseRate = 1;
  private stoppedInternal = false;
  private volumeInternal: number;
  private pitchInternal: number;

  constructor(
    clipId: string,
    options: AudioPlayOptions = {},
    private readonly onStop: (handle: RuntimeAudioPlaybackHandle) => void = () => undefined,
  ) {
    this.clipId = clipId;
    this.volumeInternal = sanitizeVolume(options.volume);
    this.pitchInternal = sanitizePitch(options.pitch);
  }

  get stopped(): boolean {
    return this.stoppedInternal;
  }

  get volume(): number {
    return this.volumeInternal;
  }

  get pitch(): number {
    return this.pitchInternal;
  }

  attach(context: BrowserAudioContext, source: AudioSourceNode, gain: GainNode): void {
    this.context = context;
    this.source = source;
    this.gain = gain;
    this.sourceBaseRate = sourcePitchBase(source);
    applySourcePitch(source, this.pitchInternal, this.sourceBaseRate);
    gain.gain.value = this.volumeInternal;
    source.onended = () => this.finish();
    if (this.stoppedInternal) this.stop(0);
  }

  stop(fadeSeconds = 0): void {
    this.finish();
    const source = this.source;
    const gain = this.gain;
    const context = this.context;
    if (!source || !context) return;

    const now = context.currentTime;
    const fade = Math.max(0, fadeSeconds);
    const stopTime = fade > 0 ? now + fade : now;
    if (gain) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      if (fade > 0) gain.gain.linearRampToValueAtTime(0, stopTime);
      else gain.gain.setValueAtTime(0, now);
    }
    try {
      source.stop(stopTime);
    } catch {
      // Web Audio throws if a source was already stopped; handles are idempotent.
    }
  }

  setVolume(value: number, fadeSeconds = 0): void {
    const next = sanitizeVolume(value);
    this.volumeInternal = next;
    const gain = this.gain;
    const context = this.context;
    if (!gain || !context || this.stoppedInternal) return;

    const now = context.currentTime;
    const fade = Math.max(0, fadeSeconds);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    if (fade > 0) gain.gain.linearRampToValueAtTime(next, now + fade);
    else gain.gain.setValueAtTime(next, now);
  }

  setPitch(value: number): void {
    this.pitchInternal = sanitizePitch(value);
    if (this.source) applySourcePitch(this.source, this.pitchInternal, this.sourceBaseRate);
  }

  private finish(): void {
    if (this.stoppedInternal) return;
    this.stoppedInternal = true;
    this.onStop(this);
  }
}

function sanitizeVolume(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 1;
}

function sanitizePitch(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function sourcePitchBase(source: AudioSourceNode): number {
  if ("playbackRate" in source) return source.playbackRate.value;
  return source.frequency.value;
}

function applySourcePitch(source: AudioSourceNode, pitch: number, base: number): void {
  if ("playbackRate" in source) source.playbackRate.value = base * pitch;
  else source.frequency.value = base * pitch;
}

export class AudioSubsystem implements Subsystem, AudioBus {
  readonly id = AUDIO_SUBSYSTEM_ID;
  private readonly backend: AudioBackend;
  private readonly clips: AudioClipManifest;
  private readonly resolveClipUrl?: (clipId: string) => string | null;
  private context: BrowserAudioContext | null = null;
  private pending: Array<{ request: AudioPlayRequest; handle: RuntimeAudioPlaybackHandle }> = [];
  private readonly active = new Set<RuntimeAudioPlaybackHandle>();
  private played: AudioPlayRequest[] = [];
  /** Decoded audio buffers keyed by URL; promise-cached so each file loads once. */
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

  constructor(options: AudioSubsystemOptions = {}) {
    this.backend = options.backend ?? "none";
    this.clips = options.clips ?? DEFAULT_AUDIO_CLIP_MANIFEST;
    if (options.resolveClipUrl) this.resolveClipUrl = options.resolveClipUrl;
  }

  /**
   * Resumes the audio context (browser autoplay policies suspend it until a user
   * gesture). The host should call this on the first pointer/key input so
   * auto-played ambient cues queued at scene load begin sounding.
   */
  resumeContext(): void {
    void this.context?.resume().catch(() => undefined);
  }

  playOneShot(clipId: string, options: AudioPlayOptions = {}): void {
    this.play(clipId, options);
  }

  play(clipId: string, options: AudioPlayOptions = {}): AudioPlaybackHandle {
    const request = { clipId, ...options };
    const handle = new RuntimeAudioPlaybackHandle(clipId, options, (stopped) => {
      this.active.delete(stopped);
    });
    this.active.add(handle);
    this.pending.push({ request, handle });
    return handle;
  }

  playedRequests(): readonly AudioPlayRequest[] {
    return this.played;
  }

  update(_context: EngineUpdateContext): void {
    const requests = this.pending;
    this.pending = [];
    for (const { request, handle } of requests) {
      if (handle.stopped) {
        this.active.delete(handle);
        continue;
      }
      this.played.push(request);
      if (this.backend === "web-audio") this.playWebAudio(request, handle);
      else if (!request.loop) handle.stop();
    }
  }

  dispose(): void {
    for (const { handle } of this.pending) handle.stop();
    this.pending = [];
    for (const handle of this.active) handle.stop();
    this.active.clear();
    this.played = [];
    this.buffers.clear();
    void this.context?.close();
    this.context = null;
  }

  private playWebAudio(
    request: AudioPlayRequest,
    handle: RuntimeAudioPlaybackHandle,
  ): void {
    const context = this.audioContext();
    if (!context) {
      handle.stop();
      return;
    }
    void context.resume().catch(() => undefined);

    // Built-in synthesized tone clips (e.g. the collision chime).
    const tone = audioClipById(this.clips, request.clipId);
    if (tone && tone.type === "tone") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.frequency.value = tone.frequencyHz;
      oscillator.connect(gain);
      gain.connect(context.destination);
      handle.attach(context, oscillator, gain);
      if (handle.stopped) return;
      oscillator.start(now);
      oscillator.stop(now + tone.durationSeconds);
      return;
    }

    // Otherwise resolve the clip id to a fetchable audio file (manifest sound).
    const url = this.resolveClipUrl?.(request.clipId) ?? null;
    if (url) void this.playFile(context, url, request, handle);
    else handle.stop();
  }

  private async playFile(
    context: BrowserAudioContext,
    url: string,
    request: AudioPlayRequest,
    handle: RuntimeAudioPlaybackHandle,
  ): Promise<void> {
    const buffer = await this.loadBuffer(context, url);
    if (!buffer || handle.stopped) {
      if (!buffer) handle.stop();
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = request.loop ?? false;
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(context.destination);
    handle.attach(context, source, gain);
    if (handle.stopped) return;
    source.start();
  }

  private loadBuffer(context: BrowserAudioContext, url: string): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => context.decodeAudioData(data))
        .catch(() => null);
      this.buffers.set(url, pending);
    }
    return pending;
  }

  private audioContext(): BrowserAudioContext | null {
    if (this.context) return this.context;
    const ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!ctor) return null;
    this.context = new ctor();
    return this.context;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }

  var webkitAudioContext: typeof AudioContext | undefined;
}
