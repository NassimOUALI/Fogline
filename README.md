# Fogline

An offline, game-agnostic interactive map viewer. You import a **pack** for a game
(tiles + categories + markers + info) and the app shows it, remembers it, and tracks your progress.
One app identity; each game only brings its own content and a small color palette.

## Documents

| File | What it captures |
|---|---|
| [docs/00-vision.md](docs/00-vision.md) | Goals, principles, scope, non-goals |
| [docs/01-architecture.md](docs/01-architecture.md) | Monorepo, layers, ports, use cases, SOLID rules, stack |
| [docs/02-pack-format.md](docs/02-pack-format.md) | The pack format: manifest, maps, tiles, categories, markers, theme, versioning |
| [docs/03-library-and-progress.md](docs/03-library-and-progress.md) | Library registry, relinking, progress store, destructive actions, export/import |
| [docs/04-ux-and-theming.md](docs/04-ux-and-theming.md) | Home screen, map screen, filter tree, palette tokens and contrast rules |
| [docs/05-roadmap-and-decisions.md](docs/05-roadmap-and-decisions.md) | Phases, decisions made, open questions |

## Example manifests

A fictional game ("Example Game") showing every file the system reads or writes:

| File | Owner | Purpose |
|---|---|---|
| [examples/pack/manifest.json](examples/pack/manifest.json) | Pack | Identity, maps, theme, license |
| [examples/pack/data/categories.json](examples/pack/data/categories.json) | Pack | Category tree (composite) |
| [examples/pack/data/markers/overworld.json](examples/pack/data/markers/overworld.json) | Pack | Flat marker list for one map |
| [examples/pack/data/markers/caves.json](examples/pack/data/markers/caves.json) | Pack | Marker list for a second map |
| [examples/pack/data/articles/waterfall-secrets.md](examples/pack/data/articles/waterfall-secrets.md) | Pack | Optional info article |

| [examples/app-data/library.json](examples/app-data/library.json) | App | Registry of known packs |
| [examples/app-data/progress/com.example.example-game.json](examples/app-data/progress/com.example.example-game.json) | App | One pack's user progress |

## Development

Prerequisites: Node 20 or newer, pnpm 12. Rust is only needed for the desktop app (Stage 5).

```bash
pnpm install
pnpm check        # eslint + prettier, dependency-cruiser, tsc, vitest
pnpm test         # vitest only
pnpm format       # prettier --write
```

### The `fogline-pack` CLI

Run from the repository root (outputs under `local-packs/` are ignored by git):

```bash
pnpm fogline-pack demo local-packs/demo                 # generate a valid demo pack (procedural imagery)
pnpm fogline-pack demo local-packs/big --markers 20000  # stress-test pack
pnpm fogline-pack validate local-packs/demo             # errors and warnings; exit 1 on errors; --json
pnpm fogline-pack inspect local-packs/demo              # summary of a folder or .fogpack; --json
pnpm fogline-pack archive local-packs/demo local-packs/demo.fogpack
pnpm fogline-pack tiles my-map.png my-pack/maps/world   # slice an image into xyz tiles + map entry
```

`pnpm fogline-pack --help` lists every option.

### The desktop app

Needs the Tauri prerequisites (Rust with MSVC on Windows): <https://v2.tauri.app/start/prerequisites/>.

```bash
pnpm --filter @fogline/desktop tauri dev     # run the app
pnpm --filter @fogline/desktop tauri build   # installer
```

A manual test script for the library screen is in `docs/manual-tests/stage-5-desktop.md`.

### Project structure

```
packages/core          domain, ports, use cases (pure TypeScript, no I/O)
packages/pack-format   Zod schemas, validator, migrations, palette helpers
packages/pack-tools    fogline-pack CLI
apps/desktop           Tauri 2 + React desktop app
docs/                  design documents (read in order)
examples/              fictional example pack and sample app data
```

### Architectural boundaries

Dependencies point inward only: `desktop -> core -> pack-format`, `pack-tools -> pack-format`.
`core` may not import React, Tauri, Leaflet, Node built-ins or anything under `apps/`.
These rules are enforced by ESLint (`no-restricted-imports`, see `eslint.config.js`) and by
dependency-cruiser (`.dependency-cruiser.cjs`); `pnpm check` fails on any violation.

Status: Stages 1-5 complete (scaffold, pack-format, core, pack-tools CLI, desktop shell and library). See `docs/05-roadmap-and-decisions.md` for the
roadmap and the "Assumptions made" log.
