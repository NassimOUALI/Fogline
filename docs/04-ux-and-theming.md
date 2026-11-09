# 04 - UX and theming

## Identity

The layout, components, typography, spacing and interaction patterns are identical for every game.
The only per-game variation is a **color palette** from the pack manifest. Switching packs should feel
like the same app changing mood, not a different app.

## Screens

### Home (library)

First screen on launch. A grid of pack cards sorted by last opened:
thumbnail, title, game name, last opened, overall progress (collected / total), availability badge.

- Primary button: **Import pack** (folder or `.fogpack`).
- Card menu: Open, Locate (if missing), Remove from library, Delete files, Reset progress,
  Export progress, Import progress.
- Empty state explains what a pack is and offers Import.
- Optional later: "Continue where you left off" shortcut to the last pack.

### Map

- Map canvas with pan/zoom; map switcher when a pack has several maps (e.g. surface / underground).
- **Filter tree** in a side panel: the category composite with tri-state checkboxes (all / none / mixed),
  per-node counts and collected/total, expand/collapse, "hide collected" toggle.
- **Search** across marker names, results jump to and highlight the marker.
- **Marker detail panel**: name, description, generic attribute list, article link, **Mark collected**.
- **Personal pins**: right-click (long-press) to add; editable, listed under a built-in "My markers" group.
- Header shows the game name and a back button to the library.

## Marker rendering

One pin shape for all games. Category supplies icon and color; collected markers are dimmed.
Clustering at low zoom once marker counts get large.

## Palette tokens

Pack supplies up to five hex colors:

- `accent` (required), `background`, `surface`, `text`, `mapBackdrop` (color behind/around tiles).

The app derives: hover/active states, borders, muted text, focus rings, selection color.
Implementation: a single theme applier maps tokens to CSS variables on the root element; components use
only semantic Tailwind tokens (`bg-surface`, `text-muted`, `accent`), never raw colors.
Palette changes animate with a short color transition.

## Contrast rules (enforced by app and `pack-tools validate`)

- Text on surface and text on background: at least 4.5:1 (WCAG AA).
- Accent on surface (for buttons and focus): at least 3:1.
- If a pack's palette fails, the app adjusts the offending token minimally toward compliance, or falls
  back to the default palette for that token, and the validator reports it to the author.
- Marker/category colors are data and are not recolored, but the validator warns when two sibling
  categories are too similar to tell apart.

## Accessibility and input

Keyboard navigation for the filter tree and search; visible focus; marker details reachable without
hovering; respects reduced-motion; supports high DPI. Left-click selects, right-click/long-press adds a pin.
