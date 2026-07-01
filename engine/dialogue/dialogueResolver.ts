/**
 * Dialogue resolver — pure, headless, no Web Audio / DOM dependency.
 *
 * Given an authored line and a runtime play context (speaker/listener/locale),
 * it selects the best-matching {@link DialogueContextMapping} and produces a flat
 * {@link ResolvedDialogueLine} the subsystem can play. Also provides subtitle
 * duration estimation (used when a line has no recorded audio) and structural
 * validators for the two asset kinds.
 */
import {
  isDialogueAudioSourceType,
  isDialogueVoiceGender,
  isDialogueVoicePlurality,
  type DialogueAudioSourceType,
  type DialogueContextMapping,
  type DialogueLineAsset,
  type DialoguePlayContext,
  type DialogueVoiceAsset,
} from "./dialogueTypes";

/** Per-locale recording override returned by a {@link DialogueLocalizationSource}. */
export interface DialogueLocalizedAudio {
  sourceId: string;
  sourceType?: DialogueAudioSourceType;
}

/**
 * Injected localization lookup (D4). Resolves a context mapping's
 * `localizationKey` to per-locale subtitle text and, optionally, a per-locale
 * recording. Returning `undefined` means "no entry for this locale" — the
 * resolver then keeps the authored text/recording, which is the fallback policy
 * (localized → authored subtitle → spoken text; localized audio → mapping audio).
 */
export interface DialogueLocalizationSource {
  resolveSubtitle(key: string, locale?: string): string | undefined;
  resolveAudio?(key: string, locale?: string): DialogueLocalizedAudio | undefined;
}

/** A line resolved for playback: subtitle text plus the chosen audio source. */
export interface ResolvedDialogueLine {
  lineId: string;
  /** What to display: `subtitleText` when authored, else `spokenText`. */
  subtitleText: string;
  /** Chosen recording; absent when no mapping supplied audio (subtitle-only). */
  audioSourceId?: string;
  /** Source kind for `audioSourceId` (defaults to `sound`). */
  audioSourceType: DialogueAudioSourceType;
  /** Localization key of the chosen mapping, if any (D4). */
  localizationKey?: string;
  /** Speaker voice of the chosen mapping (falls back to the context speaker). */
  speakerVoiceId?: string;
  mature: boolean;
  /** Index of the matched context mapping in `line.contexts`, or -1 if none. */
  matchedContextIndex: number;
}

/** Subtitle reading-speed tuning (characters per second of on-screen text). */
export const DEFAULT_SUBTITLE_CHARS_PER_SECOND = 15;
/** Fixed padding added to every estimated subtitle so short lines don't flash. */
export const SUBTITLE_BASE_PADDING_SECONDS = 0.6;
export const MIN_SUBTITLE_SECONDS = 1.5;
export const MAX_SUBTITLE_SECONDS = 12;

export interface SubtitleDurationOptions {
  charsPerSecond?: number;
  basePaddingSeconds?: number;
  minSeconds?: number;
  maxSeconds?: number;
}

/**
 * Estimates how long a subtitle should stay on screen from its text length —
 * used when a line has no recorded audio (or the audio duration is unknown).
 * Clamped to a sane min/max so one-word barks and long paragraphs both read.
 */
export function estimateSubtitleDurationSeconds(
  text: string,
  options: SubtitleDurationOptions = {},
): number {
  const cps =
    options.charsPerSecond && options.charsPerSecond > 0
      ? options.charsPerSecond
      : DEFAULT_SUBTITLE_CHARS_PER_SECOND;
  const base = options.basePaddingSeconds ?? SUBTITLE_BASE_PADDING_SECONDS;
  const min = options.minSeconds ?? MIN_SUBTITLE_SECONDS;
  const max = options.maxSeconds ?? MAX_SUBTITLE_SECONDS;
  const chars = text.trim().length;
  const raw = base + chars / cps;
  return Math.min(max, Math.max(min, raw));
}

/**
 * Scores how well a mapping fits the play context. Higher is better; a negative
 * score marks the mapping as ineligible (a hard speaker/locale conflict).
 *
 * Rules:
 * - If the context names a speaker and the mapping's speaker differs → ineligible.
 * - If both context and mapping name a locale and they differ → ineligible.
 * - Otherwise reward, in priority order: exact locale match, directed-target
 *   match, having audio, and an explicit (non-fallback) locale.
 */
function scoreContextMapping(
  mapping: DialogueContextMapping,
  context: DialoguePlayContext,
): number {
  if (context.speakerVoiceId && mapping.speakerVoiceId !== context.speakerVoiceId) return -1;
  if (context.locale && mapping.locale && mapping.locale !== context.locale) return -1;

  let score = 0;
  if (context.locale && mapping.locale === context.locale) score += 8;
  if (
    context.targetVoiceId &&
    mapping.targetVoiceIds &&
    mapping.targetVoiceIds.includes(context.targetVoiceId)
  ) {
    score += 4;
  }
  // Prefer a mapping that actually carries a recording over a subtitle-only one.
  if (mapping.audioSourceId) score += 2;
  // A locale-tagged mapping beats a locale-agnostic fallback when both are eligible.
  if (mapping.locale) score += 1;
  return score;
}

/**
 * Resolves a line against a play context, choosing the best context mapping.
 * When no mapping is eligible the line still resolves to its subtitle text with
 * no audio (`matchedContextIndex === -1`), so a subtitle-only line always shows.
 */
export function resolveDialogueLine(
  line: DialogueLineAsset,
  context: DialoguePlayContext = {},
  localization?: DialogueLocalizationSource,
): ResolvedDialogueLine {
  let subtitleText =
    line.subtitleText && line.subtitleText.length > 0 ? line.subtitleText : line.spokenText;

  let bestIndex = -1;
  let bestScore = -1;
  line.contexts.forEach((mapping, index) => {
    const score = scoreContextMapping(mapping, context);
    // Strictly-greater keeps the earliest mapping on ties (stable, authorable order).
    if (score >= 0 && score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const chosen = bestIndex >= 0 ? line.contexts[bestIndex] : undefined;

  let audioSourceId = chosen?.audioSourceId;
  let audioSourceType: DialogueAudioSourceType =
    chosen?.audioSourceType && isDialogueAudioSourceType(chosen.audioSourceType)
      ? chosen.audioSourceType
      : "sound";

  // D4 localization: the chosen mapping's localizationKey resolves per-locale
  // subtitle text (and optionally a per-locale recording) through the injected
  // source. A missing entry (undefined) leaves the authored text/recording in
  // place, so a locale with no translation still shows the script text.
  const localizationKey = chosen?.localizationKey;
  if (localizationKey && localization) {
    const localizedSubtitle = localization.resolveSubtitle(localizationKey, context.locale);
    if (localizedSubtitle !== undefined && localizedSubtitle.length > 0) {
      subtitleText = localizedSubtitle;
    }
    const localizedAudio = localization.resolveAudio?.(localizationKey, context.locale);
    if (localizedAudio && localizedAudio.sourceId) {
      audioSourceId = localizedAudio.sourceId;
      if (localizedAudio.sourceType && isDialogueAudioSourceType(localizedAudio.sourceType)) {
        audioSourceType = localizedAudio.sourceType;
      }
    }
  }

  const resolved: ResolvedDialogueLine = {
    lineId: line.id,
    subtitleText,
    audioSourceType,
    mature: line.mature === true,
    matchedContextIndex: bestIndex,
  };
  const speakerVoiceId = chosen?.speakerVoiceId ?? context.speakerVoiceId;
  if (speakerVoiceId) resolved.speakerVoiceId = speakerVoiceId;
  if (audioSourceId) resolved.audioSourceId = audioSourceId;
  if (localizationKey) resolved.localizationKey = localizationKey;
  return resolved;
}

/** Structural validation of a Dialogue Voice asset. Returns issues (empty = ok). */
export function validateDialogueVoice(voice: DialogueVoiceAsset): string[] {
  const issues: string[] = [];
  if (!voice.id) issues.push("Dialogue voice has no id");
  if (!voice.name) issues.push(`Dialogue voice "${voice.id}" has no name`);
  if (voice.gender !== undefined && !isDialogueVoiceGender(voice.gender)) {
    issues.push(`Dialogue voice "${voice.id}" has an invalid gender: ${String(voice.gender)}`);
  }
  if (voice.plurality !== undefined && !isDialogueVoicePlurality(voice.plurality)) {
    issues.push(`Dialogue voice "${voice.id}" has an invalid plurality: ${String(voice.plurality)}`);
  }
  return issues;
}

export interface ValidateDialogueLineOptions {
  /** Known voice ids; when provided, unknown speaker/target voices are reported. */
  voiceIds?: ReadonlySet<string>;
}

/** Structural validation of a Dialogue Line asset. Returns issues (empty = ok). */
export function validateDialogueLine(
  line: DialogueLineAsset,
  options: ValidateDialogueLineOptions = {},
): string[] {
  const issues: string[] = [];
  if (!line.id) issues.push("Dialogue line has no id");
  if (!line.spokenText) issues.push(`Dialogue line "${line.id}" has no spokenText`);
  if (!Array.isArray(line.contexts) || line.contexts.length === 0) {
    issues.push(`Dialogue line "${line.id}" has no context mappings`);
    return issues;
  }

  const seenLocalizationKeys = new Set<string>();
  line.contexts.forEach((mapping, index) => {
    const where = `Dialogue line "${line.id}" context ${index}`;
    if (!mapping.speakerVoiceId) {
      issues.push(`${where} has no speakerVoiceId`);
    } else if (options.voiceIds && !options.voiceIds.has(mapping.speakerVoiceId)) {
      issues.push(`${where} references missing speaker voice: ${mapping.speakerVoiceId}`);
    }
    if (options.voiceIds && mapping.targetVoiceIds) {
      for (const targetId of mapping.targetVoiceIds) {
        if (!options.voiceIds.has(targetId)) {
          issues.push(`${where} references missing target voice: ${targetId}`);
        }
      }
    }
    if (
      mapping.audioSourceType !== undefined &&
      !isDialogueAudioSourceType(mapping.audioSourceType)
    ) {
      issues.push(`${where} has an invalid audioSourceType: ${String(mapping.audioSourceType)}`);
    }
    if (mapping.localizationKey) {
      if (seenLocalizationKeys.has(mapping.localizationKey)) {
        issues.push(`${where} repeats localizationKey: ${mapping.localizationKey}`);
      } else {
        seenLocalizationKeys.add(mapping.localizationKey);
      }
    }
  });
  return issues;
}
