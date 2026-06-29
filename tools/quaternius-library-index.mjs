#!/usr/bin/env node
// Quaternius asset-library indexer.
//
// Walks the local Quaternius archive and emits docs/quaternius artifacts:
//   docs/quaternius/QUATERNIUS_CATALOG.md
//   docs/quaternius/quaternius-assets.tsv
//   docs/quaternius/quaternius-index.json
//
// Usage:
//   node tools/quaternius-library-index.mjs [libraryRoot]

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const LIBRARY_NAME = 'quaternius';
const LIBRARY_ROOT =
  process.argv[2] ||
  process.env.QUATERNIUS_LIBRARY_ROOT ||
  'C:/Users/emret/Documents/Quaternius';

const OUT_DIR = path.join(repoRoot, 'docs', LIBRARY_NAME);
const OUT_JSON = path.join(OUT_DIR, `${LIBRARY_NAME}-index.json`);
const OUT_TSV = path.join(OUT_DIR, `${LIBRARY_NAME}-assets.tsv`);
const OUT_MD = path.join(OUT_DIR, 'QUATERNIUS_CATALOG.md');

const MODEL_EXT = new Set(['.fbx', '.gltf', '.glb', '.obj']);
const SOURCE_MODEL_EXT = new Set(['.blend']);
const MATERIAL_EXT = new Set(['.mtl']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg']);
const VIDEO_EXT = new Set(['.gif', '.mp4']);
const DATA_EXT = new Set(['.bin']);

const META_FILE = /^(license|readme|preview|colorspreview|link|overview|sample|index)/i;

const PACK_GROUPS = {
  'Characters & Animation': [
    'Animated Mech Pack',
    'Ultimate Animated Animals',
    'Ultimate Modular Men',
    'Ultimate Modular Women',
    'Universal Animation Library 2[Standard]',
    'Universal Animation Library[Standard]',
  ],
  'Worlds & Environments': [
    'Medieval Village Pack',
    'Pirate Kit',
    'Survival Pack',
    'Ultimate Fantasy RTS',
    'Ultimate Nature Pack',
    'Ultimate Stylized Nature',
    'Textured Stylized Trees',
  ],
  'Props, Food & Interiors': [
    'Sushi Restaurant Kit',
    'Ultimate Food Pack',
    'Ultimate House Interior Pack',
  ],
  'Weapons, Vehicles & Sci-Fi': [
    'Modular Sci Fi Guns',
    'Toon Shooter Game Kit',
    'Train Pack',
    'Ultimate Gun Pack',
    'Ultimate Modular Sci-Fi',
    'Ultimate Spaceships',
  ],
  'Creatures & Encounters': [
    'Ultimate Monsters',
  ],
};

const THEME_MAP = {
  'Medieval / RPG': [
    'Medieval Village Pack',
    'Ultimate Fantasy RTS',
    'Ultimate Monsters',
    'Ultimate Modular Men',
    'Ultimate Modular Women',
    'Universal Animation Library[Standard]',
    'Universal Animation Library 2[Standard]',
  ],
  'Survival / Crafting': [
    'Survival Pack',
    'Ultimate Nature Pack',
    'Ultimate Stylized Nature',
    'Textured Stylized Trees',
    'Ultimate Food Pack',
  ],
  'Shooter / Action': [
    'Toon Shooter Game Kit',
    'Ultimate Gun Pack',
    'Modular Sci Fi Guns',
    'Animated Mech Pack',
    'Ultimate Monsters',
  ],
  'Sci-Fi / Space': [
    'Ultimate Modular Sci-Fi',
    'Ultimate Spaceships',
    'Modular Sci Fi Guns',
    'Animated Mech Pack',
  ],
  'Vehicles / Transport': [
    'Train Pack',
    'Ultimate Spaceships',
    'Pirate Kit',
  ],
  'Cozy / Interior / Food': [
    'Ultimate House Interior Pack',
    'Ultimate Food Pack',
    'Sushi Restaurant Kit',
  ],
  'Nature / Animals': [
    'Ultimate Nature Pack',
    'Ultimate Stylized Nature',
    'Textured Stylized Trees',
    'Ultimate Animated Animals',
  ],
  'Pirate / Naval': [
    'Pirate Kit',
  ],
  'Character Base / Animation': [
    'Ultimate Modular Men',
    'Ultimate Modular Women',
    'Universal Animation Library[Standard]',
    'Universal Animation Library 2[Standard]',
    'Ultimate Animated Animals',
    'Animated Mech Pack',
  ],
};

const toPosix = (p) => p.split(path.sep).join('/');

function kindOf(ext) {
  if (MODEL_EXT.has(ext)) return 'model';
  if (SOURCE_MODEL_EXT.has(ext)) return 'source-model';
  if (MATERIAL_EXT.has(ext)) return 'material';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (DATA_EXT.has(ext)) return 'data';
  return 'other';
}

function tokenize(name) {
  const base = name.replace(/\.[^.]+$/, '');
  return [
    ...new Set(
      base
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_\-.()[\]]+/)
        .map((s) => s.toLowerCase())
        .filter((s) => s.length > 1 && !/^\d+$/.test(s)),
    ),
  ];
}

function groupForPack(packName) {
  for (const [group, packs] of Object.entries(PACK_GROUPS)) {
    if (packs.includes(packName)) return group;
  }
  return 'Other';
}

function kindBreakdown(kindCounts) {
  return Object.entries(kindCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${k}`)
    .join(', ');
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function findPrimaryContentRoot(packDir) {
  const entries = await fs.readdir(packDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  const files = entries.filter((e) => e.isFile());
  if (dirs.length === 1 && files.length === 0) {
    return path.join(packDir, dirs[0].name);
  }
  return packDir;
}

function fileUrl(root, relativePath) {
  return pathToFileURL(path.join(root, relativePath)).href;
}

function isPreviewFile(file) {
  const base = path.basename(file).toLowerCase();
  return /^(preview|colorspreview|sample|overview)\.(png|jpg|jpeg|gif|mp4)$/.test(base);
}

function isMetaFile(file) {
  return META_FILE.test(path.basename(file));
}

function contentFolders(contentRoot) {
  return fs.readdir(contentRoot, { withFileTypes: true })
    .then((entries) => entries.filter((e) => e.isDirectory()).map((e) => e.name).sort())
    .catch(() => []);
}

async function buildPack(packDir, packName) {
  const contentRoot = await findPrimaryContentRoot(packDir);
  const files = await walk(contentRoot);
  const preview =
    files.find((f) => /^preview\.(png|jpg|jpeg)$/i.test(path.basename(f))) ||
    files.find((f) => /^sample\.(png|jpg|jpeg)$/i.test(path.basename(f))) ||
    files.find((f) => /^preview\.(gif|mp4)$/i.test(path.basename(f))) ||
    null;
  const license = files.find((f) => /^license\.txt$/i.test(path.basename(f))) || null;
  const group = groupForPack(packName);
  const folders = await contentFolders(contentRoot);

  const assets = [];
  const kindCounts = {};
  const extensionCounts = {};

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!ext) continue;
    if (isPreviewFile(file) || isMetaFile(file)) continue;

    const kind = kindOf(ext);
    if (kind === 'other') continue;

    const relativePath = toPosix(path.relative(LIBRARY_ROOT, file));
    kindCounts[kind] = (kindCounts[kind] || 0) + 1;
    extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    assets.push({
      name: path.basename(file),
      kind,
      ext,
      pack: packName,
      group,
      path: relativePath,
      tags: tokenize(path.basename(file)),
    });
  }

  return {
    name: packName,
    folder: toPosix(path.relative(LIBRARY_ROOT, packDir)),
    contentRoot: toPosix(path.relative(LIBRARY_ROOT, contentRoot)),
    group,
    assetCount: assets.length,
    kindCounts,
    extensionCounts,
    contentFolders: folders,
    preview: preview ? toPosix(path.relative(LIBRARY_ROOT, preview)) : null,
    license: license ? toPosix(path.relative(LIBRARY_ROOT, license)) : null,
    assets,
  };
}

function renderMarkdown(catalog) {
  const { libraryRoot, generatedAt, groups, totals } = catalog;
  const lines = [];
  lines.push('# QUATERNIUS Asset Catalog');
  lines.push('');
  lines.push('> Auto-generated - do **not** edit by hand.');
  lines.push('> Regenerate with `node tools/quaternius-library-index.mjs` after adding/updating packs.');
  lines.push('');
  lines.push(`- **Library root:** \`${libraryRoot}\``);
  lines.push(`- **Generated:** ${generatedAt}`);
  lines.push(`- **Totals:** ${totals.packs} packs, ${totals.assets} assets (${kindBreakdown(totals.kindCounts)})`);
  lines.push('- **Search per-asset:** grep `docs/quaternius/quaternius-assets.tsv` (e.g. `barrel`, `tree`, `rifle`, `walk`, `spaceship`).');
  lines.push('- **Forge import note:** Prefer `.gltf`/`.glb` when present, then `.fbx`; `.blend` files are source files and `.obj` usually needs its paired `.mtl` and textures.');
  lines.push('');

  const byName = new Map();
  for (const group of groups) {
    for (const pack of group.packs) byName.set(pack.name, pack);
  }

  lines.push('## Game Theme -> Packs');
  lines.push('');
  lines.push('Quick ideation map. Use UI/audio from other libraries where Quaternius does not provide matching interface or sound packs.');
  lines.push('');
  for (const [theme, packNames] of Object.entries(THEME_MAP)) {
    const present = packNames.filter((name) => byName.has(name));
    if (present.length) lines.push(`- **${theme}:** ${present.join(', ')}`);
  }
  lines.push('');

  for (const group of groups) {
    lines.push(`## ${group.name}`);
    lines.push('');
    lines.push('| Pack | Folder | Assets | Breakdown | Content folders | Preview |');
    lines.push('| --- | --- | --: | --- | --- | --- |');
    for (const pack of group.packs) {
      const preview = pack.preview ? `[img](${fileUrl(libraryRoot, pack.preview)})` : '-';
      const folders = pack.contentFolders.length ? pack.contentFolders.slice(0, 8).join(', ') : '-';
      const suffix = pack.contentFolders.length > 8 ? ', ...' : '';
      lines.push(
        `| ${pack.name} | \`${pack.folder}\` | ${pack.assetCount} | ${kindBreakdown(pack.kindCounts) || '-'} | ${folders}${suffix} | ${preview} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Extension Breakdown');
  lines.push('');
  lines.push('| Extension | Assets |');
  lines.push('| --- | --: |');
  for (const [ext, count] of Object.entries(totals.extensionCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${ext}\` | ${count} |`);
  }
  lines.push('');

  return lines.join('\n');
}

async function main() {
  if (!(await exists(LIBRARY_ROOT))) {
    console.error(`Quaternius library not found: ${LIBRARY_ROOT}`);
    process.exit(1);
  }

  const packDirs = (await fs.readdir(LIBRARY_ROOT, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: path.join(LIBRARY_ROOT, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const packs = [];
  const totals = { packs: 0, assets: 0, kindCounts: {}, extensionCounts: {} };

  for (const { name, dir } of packDirs) {
    const pack = await buildPack(dir, name);
    packs.push(pack);
    totals.packs += 1;
    totals.assets += pack.assetCount;
    for (const [kind, count] of Object.entries(pack.kindCounts)) {
      totals.kindCounts[kind] = (totals.kindCounts[kind] || 0) + count;
    }
    for (const [ext, count] of Object.entries(pack.extensionCounts)) {
      totals.extensionCounts[ext] = (totals.extensionCounts[ext] || 0) + count;
    }
  }

  const groups = Object.keys(PACK_GROUPS)
    .map((name) => ({
      name,
      packs: packs.filter((pack) => pack.group === name),
    }))
    .filter((group) => group.packs.length);
  const other = packs.filter((pack) => pack.group === 'Other');
  if (other.length) groups.push({ name: 'Other', packs: other });

  const catalog = {
    libraryName: LIBRARY_NAME,
    libraryRoot: toPosix(LIBRARY_ROOT),
    generatedAt: new Date().toISOString(),
    totals,
    groups,
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

  const tsv = ['path\tpack\tgroup\tkind\text\ttags'];
  for (const group of groups) {
    for (const pack of group.packs) {
      for (const asset of pack.assets) {
        tsv.push(`${asset.path}\t${asset.pack}\t${asset.group}\t${asset.kind}\t${asset.ext}\t${asset.tags.join(' ')}`);
      }
    }
  }
  await fs.writeFile(OUT_TSV, tsv.join('\n') + '\n', 'utf8');
  await fs.writeFile(OUT_MD, renderMarkdown(catalog) + '\n', 'utf8');

  console.log(`Indexed ${totals.packs} packs / ${totals.assets} assets from ${LIBRARY_ROOT}`);
  console.log(`  kinds: ${kindBreakdown(totals.kindCounts)}`);
  console.log(`  -> ${path.relative(repoRoot, OUT_MD)}`);
  console.log(`  -> ${path.relative(repoRoot, OUT_TSV)}`);
  console.log(`  -> ${path.relative(repoRoot, OUT_JSON)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
