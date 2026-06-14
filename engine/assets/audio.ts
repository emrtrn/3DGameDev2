export interface ToneAudioClip {
  id: string;
  type: "tone";
  frequencyHz: number;
  durationSeconds: number;
}

export type AudioClip = ToneAudioClip;

export interface AudioClipManifest {
  schema: 1;
  clips: AudioClip[];
}

export const DEFAULT_AUDIO_CLIP_MANIFEST: AudioClipManifest = {
  schema: 1,
  clips: [
    {
      id: "collision-chime",
      type: "tone",
      frequencyHz: 660,
      durationSeconds: 0.09,
    },
  ],
};

export function audioClipById(
  manifest: AudioClipManifest,
  clipId: string,
): AudioClip | null {
  return manifest.clips.find((clip) => clip.id === clipId) ?? null;
}
