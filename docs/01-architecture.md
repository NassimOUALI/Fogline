# 01 - Architecture

## Stack

- Desktop shell: **Tauri** (small installer, fully offline, native file dialogs and trash).
- UI: **React + TypeScript + Vite + Tailwind** (shadcn/ui-style components).
- Map engine: **Leaflet** with `CRS.Simple` (flat pixel coordinates), hidden behind a `MapRenderer` port
  so MapLibre or OpenLayers can replace it later.
- Validation: **Zod** schemas in `pack-format`, also exported as JSON Schema for community tools.
- Local persistence: JSON files in the app data folder to start; SQLite later if progress grows.
- Tooling: pnpm workspaces, Vitest, ESLint, strict TypeScript.

## Monorepo layout

```
fogline/
  packages/
    core/          pure TypeScript domain + use cases + port interfaces (no I/O, no UI)
    pack-format/   schemas, validators, migrations, contrast check (shared by app and CLI)
    pack-tools/    CLI: build tiles from image, validate, archive, inspect
  apps/
    desktop/       Tauri + React: adapters (filesystem, tiles, storage, Leaflet) and UI
  docs/ examples/
```

Dependency direction is strictly inward: `desktop -> core`, `desktop -> pack-format`,
`pack-tools -> pack-format`, `core -> pack-format` (types only). `core` imports nothing from `desktop`.

## Layers

1. **Domain (`core/domain`)**: `Pack`, `GameMap`, `CategoryNode` (composite), `Marker`, `Palette`,
   `Progress`, `LibraryEntry`, `FilterState`. Plain immutable data and pure functions.
2. **Application (`core/usecases`)**: one class/function per use case, depends only on ports.
3. **Ports (`core/ports`)**: small interfaces owned by the domain.
4. **Adapters (`apps/desktop/adapters`)**: implement the ports using Tauri, the filesystem, Leaflet.
5. **UI (`apps/desktop/ui`)**: React components and view-models; calls use cases, renders results.

## Ports

| Port | Responsibility |
|---|---|
| `PackReader` | Read and validate a pack's manifest, categories and markers from a location |
| `TileSource` | Provide tiles for a map (adapters: `XyzFolderTileSource`, `PmTilesTileSource`) |
| `LibraryRepository` | Persist the registry of known packs |
| `ProgressStore` | Persist per-pack progress, filters, personal pins |
| `FileSystem` | Pick files/folders, grant access, move to trash, read/write exports |
| `MapRenderer` | Show a map, markers and viewport; emit click/move events |
| `Clock`, `IdGenerator` | Make use cases deterministic and testable |

Ports are kept small (interface segregation): a use case lists only what it needs.

## Use cases

Library: `ListLibrary`, `ImportPack`, `RelinkPack`, `RemoveFromLibrary`, `DeletePackFiles`, `OpenPack`.
Progress: `ToggleCollected`, `ResetProgress`, `ExportProgress`, `ImportProgress`, `AddPersonalMarker`,
`SaveFilterState`.
Exploration: `BuildCategoryTree`, `ApplyFilter`, `SearchMarkers`, `GetMarkerDetails`.

## Composite: category tree

`CategoryNode` has two kinds sharing one interface: `Group` (has children) and `Category` (leaf).
Operations such as `count()`, `collectedCount(progress)`, `isVisible(filter)`, and `leafIds()` work on any
node. Markers are **not** nested in the tree; they stay a flat list referencing leaf ids for fast
rendering. Filter state is a separate set of hidden node ids, never stored on the nodes.

## Extension points (open/closed)

- New tile storage: implement `TileSource`, register by `tiles.type`.
- New manifest versions: add a migration in `pack-format`, old packs keep working.
- Future filter facets (regions, tags): composable `Specification` objects (AND/OR/NOT), another composite.
- New renderer: implement `MapRenderer`.

## SOLID checklist (used in code review)

- S: each use case does one thing; adapters do one kind of I/O.
- O: add a new tile source or manifest version without editing existing code paths.
- L: every `TileSource`/`ProgressStore` implementation passes the same contract tests.
- I: ports stay small and role-specific.
- D: `core` depends on abstractions it defines; adapters depend on `core`, never the reverse.

## Testing

`core` is tested without any browser or Tauri. Adapters get contract tests shared across implementations.
`pack-format` has fixture packs (valid and deliberately broken) used by both the app and the CLI.
