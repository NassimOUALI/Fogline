# 05 - Roadmap and decisions

## Decisions made

| # | Decision |
|---|---|
| 1 | Desktop-only app using Tauri; UI in React + TypeScript + Vite + Tailwind. |
| 2 | One self-contained pack per game (tiles and data together, not split). |
| 3 | Game-agnostic app; the only per-game customization is a color palette. |
| 4 | Category structure is a composite tree; markers are a flat list referencing leaf ids. |
| 5 | Filter state is separate from the tree and persisted with progress. |
| 6 | Library keeps a registry with saved paths, a Missing state and a Locate action. |
| 7 | Progress is stored outside packs, keyed by pack id; marker ids must be stable. |
| 8 | Delete pack files, remove from library, and reset progress are three separate actions. |
| 9 | Packs are folders or `.fogpack` archives; folders are referenced, archives are extracted. |
| 10 | Clean, port-based architecture in a monorepo; `core` has no I/O or UI dependencies. |

## Defaults assumed (not yet confirmed - easy to change)

- Leaflet as the map engine behind a `MapRenderer` port.
- Multiple maps per pack supported from v1.
- Tile storage: both `xyz` folders and `pmtiles`, via two `TileSource` adapters.
- Library remembers installed packs and the last opened one.
- Reference-in-place on import with an optional "copy into library".

## Open questions

1. Working title and the archive extension (`.fogpack` is a placeholder).
2. Is `pmtiles` worth the extra adapter in v1, or ship `xyz` first?
3. Progress storage: JSON files first, or SQLite from the start?
4. Languages for the app UI itself (pack content is already localizable).
5. Should a pack's `license` block be shown prominently on import (recommended for community packs)?
6. Future hub: host tiles, or only user-created marker/info data? (Affects manifest fields.)

## Phases

1. **Foundations**: monorepo, `pack-format` schemas + validator + fixtures, `core` domain and use cases
   with in-memory adapters, full unit tests. Fictional example pack validates.
2. **Desktop shell**: Tauri app, filesystem/library/progress adapters, home screen with import,
   remove, delete, locate.
3. **Map experience**: Leaflet adapter, `xyz` tiles, marker rendering, filter tree, search, details,
   mark collected, personal pins, resume view.
4. **Theming and polish**: palette tokens, contrast enforcement, empty/error states, accessibility,
   clustering, progress export/import.
5. **Authoring tools**: `pack-tools` (image -> tiles, validate, archive, inspect), published JSON Schema,
   author guide.
6. **Later**: `pmtiles`, regions/tags facets (Specification pattern), articles, update packs/deltas,
   community hub.

## Definition of done for the format

A third party can build a valid pack from the docs and JSON Schema alone, and `pack-tools validate`
tells them exactly what is wrong.
---

## Assumptions made

Implementation choices taken where the docs were silent or in tension. Each can be revisited without
changing the pack format unless noted. Dates are when the assumption was recorded.

| #   | Assumption                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Rationale                                                                                          | Recorded   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------- |
| A1  | The master prompt's `prompts/00-system-prompt.md` was not available. The port list is taken verbatim from `01-architecture.md` (`PackReader`, `TileSource`, `LibraryRepository`, `ProgressStore`, `FileSystem`, `MapRenderer`, `Clock`, `IdGenerator`), the legal boundary from `00-vision.md` (no game art or data in the repo, no game-specific code, procedural demo imagery only). Stage reports use: Plan / Done / Tests / Assumptions added / Open items. | Nothing else to go on; the docs cover the same ground.                                             | 2026-11-09 |
| A2  | The validator takes `files: "check" \| "skip"`. Schema and semantic checks are pure; file existence and tile sampling run only in `check` mode. `examples/pack` (which ships no tiles, icons or thumbnail) must have zero errors in `skip` mode, and a test asserts exactly which `file.missing` / `tiles.missing` codes appear in `check` mode. The CLI defaults to `check` with `--skip-files`; the app always checks on import.                              | Keeps the examples small and untouched while still exercising the I/O checks.                      | 2026-11-09 |
| A3  | `pmtiles` is accepted by the schema and the validator only checks the file exists. The app opens such packs and shows that map as "unsupported tile source in this version". `PmTilesTileSource` is a TODO.                                                                                                                                                                                                                                                     | Open question 2; `xyz` first.                                                                      | 2026-11-09 |
| A4  | `filters.hiddenNodeIds` is normalized to **leaf** ids. Toggling a group adds or removes all its leaf ids. Tri-state: no leaves hidden = `all`, every leaf hidden = `none`, otherwise `mixed`. Unknown ids are kept but ignored.                                                                                                                                                                                                                                 | Stable across pack updates that reorganize groups; simple to persist.                              | 2026-11-09 |
| A5  | Manifest `markers` keys must each name an existing map (error `markers.unknownMap`); a map without a markers entry is a warning (`map.noMarkers`). Marker ids are unique across the whole pack, not per file.                                                                                                                                                                                                                                                   | Progress is keyed by marker id alone.                                                              | 2026-11-09 |
| A6  | `LibraryEntry.title` is a plain string resolved at import time with `defaultLanguage`. `thumbnail` is relative to the app data folder. `status` is persisted as a cache and recomputed on launch. `library.json` carries `formatVersion`.                                                                                                                                                                                                                       | Library cards need plain strings; the example file already has `formatVersion`.                    | 2026-11-09 |
| A7  | Category depth over 6 is an error (`category.tooDeep`). Marker `tags` are accepted as `string[]` and ignored. Category ids starting with `_` are reserved for the app (built-in "My markers" group) and rejected (`id.reserved`).                                                                                                                                                                                                                               | Doc 02 states the depth limit; a reserved prefix avoids collisions with personal pins.             | 2026-11-09 |
| A8  | Contrast checks fill missing palette tokens from the app default palette first, then check text/background and text/surface at 4.5:1 and accent/surface at 3:1. `mapBackdrop` is not checked. The shared palette helper adjusts the lightness of the offending token minimally and reports each adjustment; if no compliant value exists it falls back to the default token.                                                                                    | Only `accent` is required, so pairs need defaults to be checkable.                                 | 2026-11-09 |
| A9  | Sibling leaf colors are "too similar" (warning `category.similarColors`) when their CIE76 delta E is below 15. The threshold is a named constant.                                                                                                                                                                                                                                                                                                               | The docs give no metric; CIE76 is simple and good enough for a warning.                            | 2026-11-09 |
| A10 | Tile geometry: `maxZoom` is the native zoom. At zoom `z` the image is scaled by `2^(z - maxZoom)`; the grid is `ceil(w_z / tileSize) x ceil(h_z / tileSize)`. The validator warns when `maxZoom` is inconsistent with `size` and `tileSize`. `fogline-pack tiles` computes `maxZoom = ceil(log2(max(w, h) / tileSize))`.                                                                                                                                        | Needed for tile sampling, slicing and Leaflet `CRS.Simple` to agree.                               | 2026-11-09 |
| A11 | Progress import merge: `collected` is a union keeping the newest timestamp; `customMarkers` is a union by id with the imported pin winning; `filters` are replaced only in replace mode. Markers absent from the pack are reported and skipped. Export marks removed markers as "no longer in pack".                                                                                                                                                            | Doc 03 only specifies `collected`.                                                                 | 2026-11-09 |
| A12 | `DeletePackFiles` runs only when the registered path exists and contains a `manifest.json` whose `id` equals the entry's `packId`; it then calls `FileSystem.moveToTrash(path)` and never touches another path.                                                                                                                                                                                                                                                 | Doc 03: "only for packs the app can safely identify".                                              | 2026-11-09 |
| A13 | Workspace packages are consumed from TypeScript source (`exports` -> `src/index.ts`, `paths` in `tsconfig.base.json`, Vitest aliases). Published builds are a later concern (the CLI will bundle).                                                                                                                                                                                                                                                              | No build step before tests; no stale `dist`.                                                       | 2026-11-09 |
| A14 | TypeScript is pinned to major 6 because typescript-eslint does not yet support TypeScript 7.                                                                                                                                                                                                                                                                                                                                                                    | Tooling compatibility.                                                                             | 2026-11-09 |
| A15 | `pnpm check` = ESLint + Prettier check, dependency-cruiser, `tsc --noEmit` per package, Vitest. Boundaries are enforced twice: ESLint `no-restricted-imports` per package folder and dependency-cruiser on the resolved module graph.                                                                                                                                                                                                                           | ESLint gives fast local feedback; dependency-cruiser catches dynamic imports and transitive paths. | 2026-11-09 |
