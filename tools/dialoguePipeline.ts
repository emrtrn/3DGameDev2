/**
 * Dialogue production pipeline (Dialogue & Voice, Faz D4) — pure, headless
 * helpers for the recording/translation workflow. No fs, no DOM: a CLI or a
 * dev endpoint supplies the loaded assets and writes the results.
 *
 * The unit is a *recording sheet*: one row per dialogue-line context mapping,
 * flattening spoken/subtitle text, speaker/target voices, locale, localization
 * key, voice-actor direction and the assigned recording. It exports to CSV (for
 * voice actors / translators in a spreadsheet) or JSON, and parses either back.
 *
 * On top of the sheet it builds the reports D4 calls for:
 * - {@link findMissingRecordings}: contexts with no assigned audio.
 * - {@link collectVoiceDirections}: the voice-actor direction notes per line.
 * - {@link findMissingLocalizedSubtitles}: localization keys with no string in a
 *   given locale table (the pre-build "missing localized asset" report).
 * - {@link buildLocaleTableFromSheet}: turns a filled-in sheet into a locale's
 *   `key → text` string map (the input side of subtitle localization).
 */
import type { DialogueLineAsset } from "../engine/dialogue/dialogueTypes";

/** One flattened recording-sheet row: a single dialogue-line context mapping. */
export interface RecordingSheetRow {
  lineId: string;
  /** Index of the mapping in `line.contexts`, or -1 for a line with no contexts. */
  contextIndex: number;
  speakerVoiceId: string;
  /** Target voices joined by `|` (empty = any listener). */
  targetVoiceIds: string;
  locale: string;
  localizationKey: string;
  spokenText: string;
  /** Authored subtitle (or the spoken text when the line has no override). */
  subtitleText: string;
  voiceActorDirection: string;
  audioSourceId: string;
  audioSourceType: string;
  mature: boolean;
  /** True when this context has an assigned recording. */
  hasRecording: boolean;
}

/** Column order for CSV/JSON export; also the accepted CSV header. */
export const RECORDING_SHEET_COLUMNS = [
  "lineId",
  "contextIndex",
  "speakerVoiceId",
  "targetVoiceIds",
  "locale",
  "localizationKey",
  "spokenText",
  "subtitleText",
  "voiceActorDirection",
  "audioSourceId",
  "audioSourceType",
  "mature",
  "hasRecording",
] as const;

/**
 * Flattens dialogue lines into recording-sheet rows — one per context mapping.
 * A line with no contexts still yields a single `contextIndex: -1` row so the
 * script/VO sheet never silently drops a line.
 */
export function buildRecordingSheet(lines: Iterable<DialogueLineAsset>): RecordingSheetRow[] {
  const rows: RecordingSheetRow[] = [];
  for (const line of lines) {
    const authoredSubtitle =
      line.subtitleText && line.subtitleText.length > 0 ? line.subtitleText : line.spokenText;
    const direction = line.voiceActorDirection ?? "";
    const mature = line.mature === true;
    const contexts = Array.isArray(line.contexts) ? line.contexts : [];
    if (contexts.length === 0) {
      rows.push({
        lineId: line.id,
        contextIndex: -1,
        speakerVoiceId: "",
        targetVoiceIds: "",
        locale: "",
        localizationKey: "",
        spokenText: line.spokenText,
        subtitleText: authoredSubtitle,
        voiceActorDirection: direction,
        audioSourceId: "",
        audioSourceType: "",
        mature,
        hasRecording: false,
      });
      continue;
    }
    contexts.forEach((ctx, index) => {
      rows.push({
        lineId: line.id,
        contextIndex: index,
        speakerVoiceId: ctx.speakerVoiceId ?? "",
        targetVoiceIds: (ctx.targetVoiceIds ?? []).join("|"),
        locale: ctx.locale ?? "",
        localizationKey: ctx.localizationKey ?? "",
        spokenText: line.spokenText,
        subtitleText: authoredSubtitle,
        voiceActorDirection: direction,
        audioSourceId: ctx.audioSourceId ?? "",
        audioSourceType: ctx.audioSourceType ?? "",
        mature,
        hasRecording: Boolean(ctx.audioSourceId),
      });
    });
  }
  return rows;
}

function rowToCells(row: RecordingSheetRow): string[] {
  return [
    row.lineId,
    String(row.contextIndex),
    row.speakerVoiceId,
    row.targetVoiceIds,
    row.locale,
    row.localizationKey,
    row.spokenText,
    row.subtitleText,
    row.voiceActorDirection,
    row.audioSourceId,
    row.audioSourceType,
    row.mature ? "yes" : "",
    row.hasRecording ? "yes" : "",
  ];
}

function isTruthyCell(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1";
}

function cellsToRow(cell: (name: string) => string): RecordingSheetRow {
  const parsedIndex = Number.parseInt(cell("contextIndex"), 10);
  return {
    lineId: cell("lineId"),
    contextIndex: Number.isFinite(parsedIndex) ? parsedIndex : -1,
    speakerVoiceId: cell("speakerVoiceId"),
    targetVoiceIds: cell("targetVoiceIds"),
    locale: cell("locale"),
    localizationKey: cell("localizationKey"),
    spokenText: cell("spokenText"),
    subtitleText: cell("subtitleText"),
    voiceActorDirection: cell("voiceActorDirection"),
    audioSourceId: cell("audioSourceId"),
    audioSourceType: cell("audioSourceType"),
    mature: isTruthyCell(cell("mature")),
    hasRecording: isTruthyCell(cell("hasRecording")),
  };
}

/** Quotes a CSV cell when it holds a comma, quote or newline (RFC 4180 escaping). */
function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Serializes rows to CSV (CRLF line endings, leading header row). */
export function recordingSheetToCsv(rows: RecordingSheetRow[]): string {
  const out = [RECORDING_SHEET_COLUMNS.join(",")];
  for (const row of rows) out.push(rowToCells(row).map(escapeCsvCell).join(","));
  return out.join("\r\n") + "\r\n";
}

/** Splits CSV text into records of cells, honouring quotes and embedded newlines. */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = (): void => {
    record.push(field);
    field = "";
  };
  const pushRecord = (): void => {
    records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushField();
      pushRecord();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) {
    pushField();
    pushRecord();
  }
  // Drop blank lines (a stray empty record from trailing newlines).
  return records.filter((rec) => !(rec.length === 1 && rec[0] === ""));
}

/**
 * Parses a recording sheet CSV back into rows. A leading `lineId` header row is
 * honoured (columns may be reordered); without one the canonical column order is
 * assumed. Unknown columns are ignored; missing ones resolve to empty.
 */
export function parseRecordingSheetCsv(csv: string): RecordingSheetRow[] {
  const records = parseCsvRecords(csv);
  if (records.length === 0) return [];
  const first = records[0] ?? [];
  const hasHeader = first.includes("lineId");
  const columns = hasHeader ? first : [...RECORDING_SHEET_COLUMNS];
  const dataRecords = hasHeader ? records.slice(1) : records;
  return dataRecords.map((rec) =>
    cellsToRow((name) => {
      const at = columns.indexOf(name);
      return at >= 0 && at < rec.length ? (rec[at] ?? "") : "";
    }),
  );
}

/** Serializes rows to pretty-printed JSON (newline-terminated). */
export function recordingSheetToJson(rows: RecordingSheetRow[]): string {
  return JSON.stringify(rows, null, 2) + "\n";
}

/** Parses a recording sheet from JSON (array of row objects). Malformed → []. */
export function parseRecordingSheetJson(json: string): RecordingSheetRow[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.map((entry) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    return cellsToRow((name) => {
      const value = record[name];
      if (typeof value === "boolean") return value ? "yes" : "";
      if (typeof value === "number") return String(value);
      return typeof value === "string" ? value : "";
    });
  });
}

/** A context mapping with no assigned recording (the missing-recording report). */
export interface MissingRecording {
  lineId: string;
  contextIndex: number;
  speakerVoiceId: string;
  locale: string;
  localizationKey: string;
}

/** Lists every dialogue-line context that has no `audioSourceId` assigned. */
export function findMissingRecordings(lines: Iterable<DialogueLineAsset>): MissingRecording[] {
  const out: MissingRecording[] = [];
  for (const line of lines) {
    const contexts = Array.isArray(line.contexts) ? line.contexts : [];
    if (contexts.length === 0) {
      out.push({ lineId: line.id, contextIndex: -1, speakerVoiceId: "", locale: "", localizationKey: "" });
      continue;
    }
    contexts.forEach((ctx, index) => {
      if (!ctx.audioSourceId) {
        out.push({
          lineId: line.id,
          contextIndex: index,
          speakerVoiceId: ctx.speakerVoiceId ?? "",
          locale: ctx.locale ?? "",
          localizationKey: ctx.localizationKey ?? "",
        });
      }
    });
  }
  return out;
}

/** One line's voice-actor direction note. */
export interface VoiceDirectionEntry {
  lineId: string;
  spokenText: string;
  voiceActorDirection: string;
}

/** Collects the voice-actor direction notes for every line that carries one. */
export function collectVoiceDirections(lines: Iterable<DialogueLineAsset>): VoiceDirectionEntry[] {
  const out: VoiceDirectionEntry[] = [];
  for (const line of lines) {
    if (line.voiceActorDirection && line.voiceActorDirection.length > 0) {
      out.push({
        lineId: line.id,
        spokenText: line.spokenText,
        voiceActorDirection: line.voiceActorDirection,
      });
    }
  }
  return out;
}

/** A locale's flat `key → text` string table (the `.loc.json` `strings` shape). */
export interface LocaleStringTable {
  locale: string;
  strings: Record<string, string>;
}

/**
 * Maps each authored `localizationKey` to the line ids that reference it, so a
 * report can point back from a missing translation to the affected lines.
 */
export function collectLocalizationKeys(
  lines: Iterable<DialogueLineAsset>,
): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const line of lines) {
    for (const ctx of line.contexts ?? []) {
      const key = ctx.localizationKey;
      if (!key) continue;
      const ids = byKey.get(key) ?? [];
      if (!ids.includes(line.id)) ids.push(line.id);
      byKey.set(key, ids);
    }
  }
  return byKey;
}

/** A localization key with no string in a given locale table. */
export interface MissingLocalizedSubtitle {
  locale: string;
  localizationKey: string;
  /** Line ids that reference this key (so the report is actionable). */
  lineIds: string[];
}

/**
 * The pre-build "missing localized asset" report: for each locale table, every
 * authored localization key that has no (non-empty) string. Runs the fallback
 * policy's blind spot check — these keys would fall back to the authored text.
 */
export function findMissingLocalizedSubtitles(
  lines: Iterable<DialogueLineAsset>,
  tables: Iterable<LocaleStringTable>,
): MissingLocalizedSubtitle[] {
  const keys = collectLocalizationKeys(lines);
  const out: MissingLocalizedSubtitle[] = [];
  for (const table of tables) {
    for (const [key, lineIds] of keys) {
      const value = table.strings[key];
      if (value === undefined || value === "") {
        out.push({ locale: table.locale, localizationKey: key, lineIds: [...lineIds] });
      }
    }
  }
  return out;
}

/**
 * Turns a filled-in recording sheet into a locale's `key → subtitle` map — the
 * input side of subtitle localization. Rows tagged with a different locale are
 * skipped; locale-agnostic rows (no `locale`) always apply. Later rows win.
 */
export function buildLocaleTableFromSheet(
  rows: Iterable<RecordingSheetRow>,
  locale: string,
): Record<string, string> {
  const strings: Record<string, string> = {};
  for (const row of rows) {
    if (!row.localizationKey) continue;
    if (row.locale && row.locale !== locale) continue;
    if (row.subtitleText) strings[row.localizationKey] = row.subtitleText;
  }
  return strings;
}
