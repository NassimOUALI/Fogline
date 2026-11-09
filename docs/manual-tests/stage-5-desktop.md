# Manual test script: desktop shell and library (Stage 5)

Run these on Windows, macOS or Linux after the automated suite (`pnpm check`) passes. Each step
lists what you do and what you should see. Stop and note the step number if anything differs.

## Prerequisites

- Node 20+, pnpm, and the Tauri prerequisites for your OS: <https://v2.tauri.app/start/prerequisites/>
  (on Windows: rustup with the MSVC toolchain, and Visual Studio Build Tools with
  "Desktop development with C++"; WebView2 ships with Windows 11).
- `tauri info` (from `apps/desktop`: `pnpm tauri info`) shows no ✘ lines.

## Setup

```bash
pnpm install
pnpm fogline-pack demo local-packs/demo                         # valid demo pack
pnpm fogline-pack archive local-packs/demo local-packs/demo.fogpack
pnpm fogline-pack demo local-packs/demo-v2 --seed 2             # same id, different content
```

Edit `local-packs/demo-v2/manifest.json` and set `"version": "1.1.0"`.

The app keeps its data in the OS app data folder for `dev.fogline.app`
(Windows: `%APPDATA%\dev.fogline.app`). Delete that folder before step 1 for a clean start.

## Steps

| # | Do | Expect |
|---|---|---|
| 1 | `pnpm --filter @fogline/desktop tauri dev` | The Fogline window opens on the library screen: "Your library is empty", an explanation of packs, and an **Import a pack** button. |
| 2 | **Import pack** → **Choose a pack folder…** → pick `local-packs/demo`. | "Validating pack…" then a success line `Imported "Demo Realm - Procedural Atlas".` A card shows the surface-map thumbnail, title, "Demo Realm", "Never opened", "0 / 48 collected", 0%, and an **Available** badge. |
| 3 | Look in the app data folder. | `library.json` lists the pack with `"source": "referenced"` and the path of `local-packs/demo`; `thumbnails/dev.fogline.demo.webp` exists. |
| 4 | Click **Open**. | The pack screen shows the game name, the title, the two maps with their sizes, and "0 / 33 collected" and "0 / 15 collected". The colors change briefly (cross-fade) to the pack palette (blue accent). |
| 5 | Click **← Library**. | Back on the library; the default palette returns; the card says "Opened today". |
| 6 | Close the app window, then run step 1 again. | The card is still there with "Opened today": the library survived the restart. |
| 7 | Close the app. Rename `local-packs/demo` to `local-packs/demo-moved`. Start the app. | The card shows **Unavailable**, a greyed thumbnail, and a **Locate…** button instead of Open. |
| 8 | Click **Locate…** and pick `local-packs/demo-moved`. | `"Demo Realm - Procedural Atlas" is available again.` The badge returns to Available; **Open** works. |
| 9 | Click **Locate…** on a missing pack (repeat step 7) and pick `examples/pack`. | A dialog "That folder does not match" says the folder contains pack "com.example.example-game", not "dev.fogline.demo". Nothing changes. Then locate the right folder again. |
| 10 | **Import pack** → **Choose a pack folder…** → `examples/pack`. | A dialog "This pack cannot be imported" lists errors such as "File not found: icons/chest.svg" and missing tiles, each with its code and location. The library is unchanged. |
| 11 | **Import pack** → **Choose a .fogpack archive…** → `local-packs/demo.fogpack`. | A dialog asks `Update "Demo Realm - Procedural Atlas"?` (same pack id, same version). Cancel. Nothing changes. |
| 12 | **Import pack** → folder → `local-packs/demo-v2`. | `Update ...?` with "The library has version 1.0.0; this pack is version 1.1.0 ... Your progress is kept." Click **Update pack**: "Updated ...". |
| 13 | **More…** → **Export progress…** → save as `progress.json`. | `Exported progress to ...progress.json.` The file holds `"packId": "dev.fogline.demo"` and `"packVersion": "1.1.0"`. |
| 14 | Edit `progress.json`: add two entries to `"collected"` using two marker ids from `local-packs/demo-v2/data/markers/surface.json`, and one made-up id `"gone-001"`. **More…** → **Import progress…** → pick it. | A dialog shows the counts. Click **Merge**: "Merged progress ...: 2 collected markers ... 1 entry no longer in this pack were skipped." The card shows "2 / 48 collected". |
| 15 | **More…** → **Reset progress…** | The dialog lists "2 collected markers", "0 personal pins", "0 hidden categories". **Reset progress** stays disabled until you type `reset`. Confirm: the card shows "0 / 48 collected". |
| 16 | **More…** → **Remove from library…** → leave "Also clear my progress" unticked → **Remove**. | The card disappears; the success line says files were not touched and progress was kept. `local-packs/demo-v2` still exists. |
| 17 | Import `local-packs/demo-v2` again, then **More…** → **Delete pack files…** | The dialog shows the exact folder path. **Move to trash** stays disabled until you type `delete`. Confirm: "Moved ... to the trash." The folder is in the system trash (restore it from there), and the card is gone. |
| 18 | Import `local-packs/demo.fogpack` (archive). | Imported as a copy: `library.json` shows `"source": "copied"` and a path under the app data `library/` folder. |
| 19 | Keyboard only: Tab through the library. | Every button shows a visible focus ring; **More…** opens its menu with Enter; Escape closes dialogs. |
| 20 | Corrupt `library.json` (type random text into it) and start the app. | The app starts with an empty library and the console warns that the file was kept as `library.json.corrupt-<time>`; the original text is in that file. |

## Not covered here

The interactive map (Stage 6): tiles, markers, filters, search, collecting, personal pins.
