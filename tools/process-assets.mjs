// Asset pipeline: raw Kenney GLB -> optimized GLB + manifest.
//
// Usage:  npm run assets:build
//
// Steps per asset (see docs/2026-06-12-engine-decision.md §4):
//   1. read raw GLB from tools/raw-assets/ (git-ignored)
//   2. dedup + prune unused data
//   3. weld + meshopt compression (EXT_meshopt_compression)
//   4. KTX2 texture compression IF toktx is on PATH (skipped + warned otherwise;
//      Kenney kits use flat vertex colors / one tiny palette PNG, so the win is small)
//   5. write to public/assets/<out> and record byte sizes
// Finally regenerates public/assets/manifest.json from tools/assets.config.mjs.
//
// Runtime note for scene-3d-dev: loading these GLBs in three.js requires the
// meshopt decoder -> GLTFLoader.setMeshoptDecoder(MeshoptDecoder) from 'meshoptimizer'.

import { execSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

import { assets } from './assets.config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'tools', 'raw-assets');
const OUT_DIR = join(ROOT, 'public', 'assets');
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');
const MANIFEST_VERSION = 1;

function hasToktx() {
  try {
    execSync('toktx --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });

  const ktx2 = hasToktx();
  if (!ktx2) {
    console.warn(
      '[assets] toktx not found - skipping KTX2 texture compression.\n' +
        '[assets] Install KTX-Software (https://github.com/KhronosGroup/KTX-Software/releases) to enable it.\n',
    );
  }

  const records = [];
  let totalIn = 0;
  let totalOut = 0;
  let failed = 0;

  for (const asset of assets) {
    const srcPath = join(RAW_DIR, asset.src);
    const outPath = join(OUT_DIR, asset.out);

    let srcBytes;
    try {
      srcBytes = statSync(srcPath).size;
    } catch {
      console.error(`[assets] MISSING SOURCE: ${asset.src} (id: ${asset.id}) - skipped`);
      failed += 1;
      continue;
    }

    const document = await io.read(srcPath);

    const transforms = [
      dedup(),
      prune(),
      weld(),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    ];
    if (ktx2) {
      transforms.push(textureCompress({ encoder: 'toktx', targetFormat: 'ktx2', mode: 'etc1s' }));
    }
    await document.transform(...transforms);

    mkdirSync(dirname(outPath), { recursive: true });
    await io.write(outPath, document);

    const outBytes = statSync(outPath).size;
    totalIn += srcBytes;
    totalOut += outBytes;

    const delta = ((outBytes / srcBytes - 1) * 100).toFixed(1);
    const sign = outBytes <= srcBytes ? '' : '+';
    console.log(
      `[assets] ${asset.id.padEnd(24)} ${kb(srcBytes).padStart(10)} -> ${kb(outBytes).padStart(10)}  (${sign}${delta}%)`,
    );

    records.push({
      id: asset.id,
      file: `assets/${asset.out.replace(/\\/g, '/')}`,
      type: 'model',
      category: asset.category,
      loadGroup: asset.loadGroup,
      source: asset.source,
      license: asset.license,
      bytes: outBytes,
    });
  }

  records.sort((a, b) => a.id.localeCompare(b.id));

  const manifest = {
    version: MANIFEST_VERSION,
    generated: new Date().toISOString().slice(0, 10),
    ktx2,
    assets: records,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\n[assets] ${records.length} asset(s) -> ${kb(totalOut)} total (raw ${kb(totalIn)}, ${((totalOut / totalIn - 1) * 100).toFixed(1)}%)`,
  );
  console.log(`[assets] manifest written: ${MANIFEST_PATH}`);

  if (failed > 0) {
    console.error(`\n[assets] ${failed} asset(s) had missing sources - manifest excludes them.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[assets] pipeline failed:', err);
  process.exitCode = 1;
});
