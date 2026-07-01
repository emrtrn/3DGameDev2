// Bundles tools/dialogueReport.ts with esbuild and runs it on node. Mirrors the
// plain-node style of tools/run-engine-tests.mjs. Run via: npm run dialogue:report
// (pass --strict to fail on any missing recording / localized subtitle).
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "dialogue-report-"));
const outfile = join(dir, "report.mjs");

try {
  await build({
    entryPoints: ["tools/dialogueReport.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  process.argv = [process.argv[0], outfile, ...process.argv.slice(2)];
  await import(pathToFileURL(outfile).href);
} catch (error) {
  console.error("[dialogue-report] FAILED");
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
