# 00 - Vision

## What it is

A desktop app that opens **map packs** offline. A pack is everything needed to explore one game's world:
tile imagery, a category tree, markers, and optional info text. The app is game-agnostic. It never
contains game-specific code or art.

## Why

Players of big open-world games want an interactive map (filters, collected tracking, search) that works
without internet. Existing options are web-only or tied to one game. A neutral viewer plus a shareable
pack format serves every game, and lets a community build and exchange packs.

## Principles

1. **One app, one identity.** Layout, controls and behavior never change per game. A pack may only supply
   content and a small color palette (see 04).
2. **Content is data.** If supporting a new game ever requires changing app code, the pack format is
   missing something. Extend the format, not the app.
3. **Offline first.** After import, nothing needs a network.
4. **User data is sacred.** Progress is stored apart from packs, survives pack updates, and is never
   deleted as a side effect of another action.
5. **Clean boundaries.** Domain logic knows nothing about React, Tauri, the filesystem or the map library.
6. **Community ready.** The format is documented, versioned, validated by a published schema, and carries
   license and attribution fields from day one.

## Scope (v1)

- Import a pack from a folder or `.fogpack` archive.
- Library home screen with recent packs, locate/relink, remove, delete files, reset/export/import progress.
- Map view: pan/zoom, multiple maps per pack, category filter tree, search, marker details,
  mark collected, personal pins.
- Per-game palette.
- A CLI (`pack-tools`) to build tiles from an image, validate a pack and create an archive.

## Non-goals (for now)

- Online hub, accounts, cloud sync, ratings.
- Shipping any game's artwork or data inside the app.
- Route planning, screenshot export, tag/region facets (the format reserves room for them).
- Mobile apps.

## Legal stance

The app and format are neutral. Packs made from extracted game artwork carry legal risk for whoever
distributes them. The manifest therefore requires license and attribution fields, and any future hub
should decide early whether it hosts tiles or only user-created marker/info data.
