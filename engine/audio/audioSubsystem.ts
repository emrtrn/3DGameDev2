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
}

export interface AudioPlayRequest extends AudioPlayOptions {
  clipId: string;
}

export interface AudioBus {
  playOneShot(clipId: string, options?: AudioPlayOptions): void;
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

export class AudioSubsystem implements Subsystem, AudioBus {
  readonly id = AUDIO_SUBSYSTEM_ID;
  private readonly backend: AudioBackend;
  private readonly clips: AudioClipManifest;
  private readonly resolveClipUrl?: (clipId: string) => string | null;
  private context: BrowserAudioContext | null = null;
  private pending: AudioPlayRequest[] = [];
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
    this.pending.push({ clipId, ...options });
  }

  playedRequests(): readonly AudioPlayRequest[] {
    return this.played;
  }

  update(_context: EngineUpdateContext): void {
    const requests = this.pending;
    this.pending = [];
    for (const request of requests) {
      this.played.push(request);
      if (this.backend === "web-audio") this.playWebAudio(request);
    }
  }

  dispose(): void {
    this.pending = [];
    this.played = [];
    this.buffers.clear();
    void this.context?.close();
    this.context = null;
  }

  private playWebAudio(request: AudioPlayRequest): void {
    const context = this.audioContext();
    if (!context) return;
    void context.resume().catch(() => undefined);

    // Built-in synthesized tone clips (e.g. the collision chime).
    const tone = audioClipById(this.clips, request.clipId);
    if (tone && tone.type === "tone") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.frequency.value = tone.frequencyHz;
      gain.gain.value = request.volume ?? 1;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + tone.durationSeconds);
      return;
    }

    // Otherwise resolve the clip id to a fetchable audio file (manifest sound).
    const url = this.resolveClipUrl?.(request.clipId) ?? null;
    if (url) void this.playFile(context, url, request);
  }

  private async playFile(
    context: BrowserAudioContext,
    url: string,
    request: AudioPlayRequest,
  ): Promise<void> {
    const buffer = await this.loadBuffer(context, url);
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = request.loop ?? false;
    const gain = context.createGain();
    gain.gain.value = request.volume ?? 1;
    source.connect(gain);
    gain.connect(context.destination);
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
