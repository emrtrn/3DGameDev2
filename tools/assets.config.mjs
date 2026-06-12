// Asset pipeline configuration — single source for which raw assets get processed.
// Every entry here becomes a manifest record in public/assets/manifest.json.
// Assets NOT listed here never enter the game (CLAUDE.md rule: no manifest, no asset).
//
// Fields:
//   id         kebab-case unique id used by the loader
//   src        path relative to tools/raw-assets/ (raw sources, git-ignored)
//   out        output path relative to public/assets/
//   category   GDD 04-content category (beds, sofas-chairs, tables-desks, storage,
//              lighting, rugs, wall-decor, plants, kitchen-table-props, room-shell)
//   loadGroup  lazy-load group; "core" is preloaded (FTUE room), everything else
//              loads on demand via dynamic import / fetch (lesson L8, first bundle < 5 MB)
//   source     provenance: { origin, pack, packVersion, url } or { origin: "generated", ... }
//   license    SPDX id (Kenney packs are CC0-1.0)

const KENNEY_FURNITURE = {
  origin: 'kenney',
  pack: 'Furniture Kit',
  packVersion: '1.0',
  url: 'https://kenney.nl/assets/furniture-kit',
};

const FURNITURE_GLB = 'furniture-kit/Models/GLTF format';

/** @param {string} name @param {string} category @param {string} loadGroup */
const furniture = (name, category, loadGroup) => ({
  id: name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
  src: `${FURNITURE_GLB}/${name}.glb`,
  out: `models/${loadGroup}/${name}.glb`,
  category,
  loadGroup,
  source: KENNEY_FURNITURE,
  license: 'CC0-1.0',
});

export const assets = [
  // --- Room shell (FTUE room, preloaded) — Furniture Kit ships its own
  //     interior wall/floor/doorway modules; Modular Buildings is exterior-only.
  furniture('floorFull', 'room-shell', 'core'),
  furniture('wall', 'room-shell', 'core'),
  furniture('wallCorner', 'room-shell', 'core'),
  furniture('wallWindow', 'room-shell', 'core'),
  furniture('doorway', 'room-shell', 'core'),

  // --- Render-test furniture set (~10 pieces, one per DD/MVP category spread)
  furniture('bedSingle', 'beds', 'furniture-beds'),
  furniture('loungeSofa', 'sofas-chairs', 'furniture-seating'),
  furniture('chairModernCushion', 'sofas-chairs', 'furniture-seating'),
  furniture('tableCoffee', 'tables-desks', 'furniture-tables'),
  furniture('desk', 'tables-desks', 'furniture-tables'),
  furniture('sideTable', 'tables-desks', 'furniture-tables'),
  furniture('bookcaseOpen', 'storage', 'furniture-storage'),
  furniture('lampRoundFloor', 'lighting', 'furniture-lighting'),
  furniture('rugRectangle', 'rugs', 'furniture-rugs'),
  furniture('pottedPlant', 'plants', 'furniture-plants'),
];
