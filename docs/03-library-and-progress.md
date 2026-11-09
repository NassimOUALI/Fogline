# 03 - Library and progress

Both live in the app data folder, **outside any pack**. Packs are never modified by the app.

## Library registry (`library.json`)

A list of `LibraryEntry`:

`packId`, `title`, `gameName`, `version`, `path` (where the pack is), `source` (`"referenced"` or `"copied"`),
`lastOpenedAt`, `importedAt`, `thumbnail` (cached small image), `status` (`"available"` or `"missing"`,
computed on launch), and cached `markerCount` so progress percentages are cheap on the home screen.

### Import

User picks a folder or `.fogpack`.

- Folder: **referenced in place** by default (light on disk). Optional checkbox "copy into library".
- Archive: extracted into the app's library folder (`source = "copied"`).
- The pack is validated before it is added. Errors block import; warnings are shown.
- Tauri restricts file access, so the app grants itself access to the picked folder at that moment
  and remembers the grant.
- Importing a pack whose `id` already exists offers: update (replace, keep progress) or cancel.

### Missing packs

If a referenced path disappears (moved, deleted, drive unplugged) the card shows **Unavailable** with a
**Locate** button that relinks it (`RelinkPack`) after checking the chosen folder has the same pack `id`.
Progress is untouched.

## Progress store (`progress/<packId>.json`)

Keyed by pack `id`. Contains:

- `collected`: map of `markerId -> collectedAt` timestamp.
- `customMarkers`: the user's own pins (`id`, `map`, `position`, `name`, `note?`, `createdAt`).
- `filters`: `hiddenNodeIds` (the filter state), plus `hideCollected`.
- `lastView`: `{ map, center, zoom }` so reopening resumes where you were.
- `packVersionSeen`: last pack version used with this progress.

Rule: marker ids are stable across pack versions, so progress survives updates.

## Actions and their exact meaning

Destructive actions are deliberately separate and named precisely.

| Action | Removes | Keeps | Confirmation |
|---|---|---|---|
| **Remove from library** | The registry entry | Pack files, progress (option: also clear progress) | Simple |
| **Delete pack files** | Pack files on disk (sent to system trash, not permanent) and the entry | Progress (option: also clear) | Strong, shows folder path |
| **Reset progress** | Collected markers, personal pins, filters for that pack | Pack, library entry | Strong, shows counts |
| **Export progress** | Nothing | Everything | None |
| **Import progress** | Nothing unless "replace" is chosen | | Choose merge or replace |

`Delete pack files` is only offered for packs the app can safely identify as the pack folder; it
never deletes outside that folder.

## Progress export format

JSON file: `formatVersion`, `packId`, `packVersion`, `exportedAt`, `collected`, `customMarkers`, `filters`.
On import the app checks `packId` matches the open pack (otherwise refuses), warns if `packVersion`
differs, and offers **merge** (union of collected, keep newest timestamps) or **replace**.
Markers in the file that no longer exist in the pack are reported and skipped.

## Use cases involved

`ListLibrary`, `ImportPack`, `RelinkPack`, `RemoveFromLibrary`, `DeletePackFiles`, `ResetProgress`,
`ExportProgress`, `ImportProgress`. Ports: `LibraryRepository`, `ProgressStore`, `FileSystem`, `PackReader`.
