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
}

type BrowserAudioContext = AudioContext;

export class AudioSubsystem implements Subsystem, AudioBus {
  readonly id = AUDIO_SUBSYSTEM_ID;
  private readonly backend: AudioBackend;
  private readonly clips: AudioClipManifest;
  private context: BrowserAudioContext | null = null;
  private pending: AudioPlayRequest[] = [];
  private played: AudioPlayRequest[] = [];

  constructor(options: AudioSubsystemOptions = {}) {
    this.backend = options.backend ?? "none";
    this.clips = options.clips ?? DEFAULT_AUDIO_CLIP_MANIFEST;
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
    void this.context?.close();
    this.context = null;
  }

  private playWebAudio(request: AudioPlayRequest): void {
    const clip = audioClipById(this.clips, request.clipId);
    if (!clip) return;
    const context = this.audioContext();
    if (!context) return;
    void context.resume().catch(() => undefined);

    if (clip.type === "tone") {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.frequency.value = clip.frequencyHz;
      gain.gain.value = request.volume ?? 1;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + clip.durationSeconds);
      return;
    }
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
