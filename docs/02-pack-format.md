# 02 - Pack format (formatVersion 1)

One pack = one game, self-contained. Tiles and data live together.

## Distribution forms

- **Folder**: opened in place (referenced, see 03).
- **`.fogpack`**: a zip archive of the same folder (tiles stored uncompressed since images are already
  compressed). Importing an archive extracts it into the app's library folder.

## Layout

```
my-game-pack/
  manifest.json            identity, maps, theme, license
  data/
    categories.json        category tree
    markers/<mapId>.json   flat marker list, one file per map
    articles/*.md          optional info text, referenced by id
  icons/*.svg              optional category icons
  maps/<mapId>/
    tiles/{z}/{x}/{y}.webp     tiles.type = "xyz"
    tiles.pmtiles              tiles.type = "pmtiles"
    thumbnail.webp             optional preview for the library card
```

## manifest.json

| Field | Req | Notes |
|---|---|---|
| `formatVersion` | yes | Integer. Drives migrations. |
| `id` | yes | Stable unique id (reverse-DNS or slug). Never changes across versions. Progress is keyed by it. |
| `game` | yes | `{ name, publisher? }` shown on library cards. |
| `title`, `description` | yes / no | Localized text. |
| `version` | yes | Semver of the pack content. |
| `authors` | yes | `[{ name, url? }]` |
| `license` | yes | `{ spdx, notes? }`. SPDX id or `"LicenseRef-Custom"`. |
| `attribution` | no | List of sources/credits. |
| `defaultLanguage` | yes | BCP 47 tag, e.g. `en`. |
| `theme.palette` | no | See below. |
| `maps` | yes | At least one map. |
| `categories` | yes | Relative path to the category file. |
| `markers` | yes | Map of `mapId -> relative path`. |

### Map entry

`id`, `name`, `order`, `size {width, height}` (source image pixels), `tileSize` (default 256),
`minZoom`, `maxZoom`, `tiles { type: "xyz" | "pmtiles", path }`, optional `thumbnail`, optional
`calibration` (affine transform from image pixels to in-game coordinates, for showing game coordinates).

Coordinate system: pixels of the source image at full resolution, origin top-left, x right, y down.
Markers use this space regardless of zoom levels.

### Palette

```
theme.palette: { accent (required), background?, surface?, text?, mapBackdrop? }   // #RRGGBB
```
Everything else (hover, borders, muted text, focus ring) is derived by the app. See 04 for contrast rules.
A pack without a palette uses the app default.

## categories.json (composite tree)

An array of nodes. A node with `children` is a **group**; without, a **leaf**.
Fields: `id` (unique across the whole tree), `name` (localized), `icon?`, `color?`, `children?`.
Rules: ids unique; markers may reference **leaves only**; max depth 6 (UI limit); colors should be
distinguishable between siblings (validator warns).

## markers/<mapId>.json

Flat array. Each marker:

| Field | Req | Notes |
|---|---|---|
| `id` | yes | **Stable across pack versions**, unique within the pack. Progress depends on it. |
| `category` | yes | A leaf id from categories.json. |
| `position` | yes | `{ x, y }` in map pixel space. |
| `name` | yes | Localized text. |
| `description` | no | Localized text. |
| `attributes` | no | `[{ key, label, value }]` rendered generically by one detail panel (rarity, set, drop...). |
| `article` | no | Id of an article under `data/articles/`. |
| `tags` | no | Reserved for future facets (regions etc.). Ignored in v1. |

## LocalizedText

Either a plain string (in `defaultLanguage`) or an object `{ "en": "...", "fr": "..." }`.
The app falls back to `defaultLanguage`, then to any available language.

## Versioning and compatibility

- `formatVersion` changes only for breaking format changes; each bump ships a migration.
- Pack `version` is semver. Updating a pack is replacing it; progress survives because `id` and marker
  ids are stable. Removed markers are simply ignored in progress (kept, shown as "no longer in pack"
  only in export).
- The app refuses packs with a newer `formatVersion` and says so clearly.

## Validation (done by both the app and `pack-tools validate`)

Schema validity; unique ids; every marker's map and category exist and category is a leaf; positions
inside map bounds (warning); tile files present for declared zooms (sampled); palette contrast;
license field present; no path escapes the pack folder.
