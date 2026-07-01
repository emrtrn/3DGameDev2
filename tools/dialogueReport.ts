/**
 * Pre-build dialogue production report (Dialogue & Voice, Faz D4).
 *
 * Reads the committed asset manifest, loads every `dialogueLine` asset and every
 * `.loc.json` locale table from `public/`, and prints the D4 production reports:
 * missing recordings, missing localized subtitles (per locale), and voice-actor
 * direction notes. Pure IO glue over the tested {@link ./dialoguePipeline}
 * functions; run via `npm run dialogue:report` (add `--strict` to fail CI when a
 * recording or localized subtitle is missing).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assetPath, assetType } from "../engine/assets/manifest";
import { isDialogueLineAsset, type DialogueLineAsset } from "../engine/dialogue/dialogueTypes";
import { normalizeUiLocaleTable } from "../engine/ui/uiLocale";
import {
  collectVoiceDirections,
  findMissingLocalizedSubtitles,
  findMissingRecordings,
  type LocaleStringTable,
} from "./dialoguePipeline";

const PUBLIC_ROOT = "public";
const MANIFEST_PATH = join(PUBLIC_ROOT, "assets", "manifest.json");
const strict = process.argv.includes("--strict");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

const manifest = readJson(MANIFEST_PATH) as { assets?: unknown[] };
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];

const lines: DialogueLineAsset[] = [];
const localeTables: LocaleStringTable[] = [];
for (const entry of assets) {
  const asset = entry as Parameters<typeof assetType>[0];
  const rel = assetPath(asset);
  if (!rel) continue;
  const type = assetType(asset);
  try {
    if (type === "dialogueLine") {
      const data = readJson(join(PUBLIC_ROOT, rel));
      if (isDialogueLineAsset(data)) lines.push(data);
    } else if (type === "ui" && rel.endsWith(".loc.json")) {
      const table = normalizeUiLocaleTable(readJson(join(PUBLIC_ROOT, rel)));
      localeTables.push({ locale: table.locale, strings: table.strings });
    }
  } catch {
    // A missing/malformed asset must not abort the report.
  }
}

const missingRecordings = findMissingRecordings(lines);
const missingLocalized = findMissingLocalizedSubtitles(lines, localeTables);
const directions = collectVoiceDirections(lines);

const locales = localeTables.map((table) => table.locale).join(", ") || "(none)";
console.log(
  `[dialogue-report] ${lines.length} line(s), ${localeTables.length} locale table(s): ${locales}`,
);

if (missingRecordings.length === 0) {
  console.log("[dialogue-report] recordings: every context has an assigned recording.");
} else {
  console.warn(`[dialogue-report] missing recordings (${missingRecordings.length}):`);
  for (const miss of missingRecordings) {
    const where = miss.contextIndex >= 0 ? `context ${miss.contextIndex}` : "no context";
    const locale = miss.locale ? ` [${miss.locale}]` : "";
    console.warn(`  - ${miss.lineId} ${where}${locale}`);
  }
}

if (localeTables.length === 0) {
  console.log("[dialogue-report] localization: no locale tables authored — subtitles use script text.");
} else if (missingLocalized.length === 0) {
  console.log("[dialogue-report] localization: every localization key is translated in every locale.");
} else {
  console.warn(`[dialogue-report] missing localized subtitles (${missingLocalized.length}):`);
  for (const miss of missingLocalized) {
    console.warn(`  - [${miss.locale}] ${miss.localizationKey} → ${miss.lineIds.join(", ")}`);
  }
}

console.log(`[dialogue-report] voice-actor direction notes: ${directions.length}`);

if (strict && (missingRecordings.length > 0 || missingLocalized.length > 0)) {
  console.error("[dialogue-report] FAIL (strict): missing recordings or localized subtitles.");
  process.exitCode = 1;
} else {
  console.log("[dialogue-report] OK");
}
