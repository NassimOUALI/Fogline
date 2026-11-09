import type { LibraryEntry } from '@fogline/pack-format';
import { localize } from './localized-text';
import type { Pack } from './pack';

export type { LibraryEntry };

export type PackStatus = LibraryEntry['status'];
export type PackSourceKind = LibraryEntry['source'];

export interface EntryLocation {
  readonly path: string;
  readonly source: PackSourceKind;
}

/**
 * A new registry entry for `pack`. The title is resolved once, in the pack's default
 * language (assumption A6).
 */
export function createLibraryEntry(pack: Pack, location: EntryLocation, now: string): LibraryEntry {
  return {
    packId: pack.id,
    title: localize(pack.title, pack.defaultLanguage, pack.defaultLanguage),
    gameName: pack.game.name,
    version: pack.version,
    path: location.path,
    source: location.source,
    importedAt: now,
    markerCount: pack.markers.length,
    status: 'available',
  };
}

/** Refreshes the cached pack fields; keeps import and open timestamps and the thumbnail. */
export function refreshEntryFromPack(
  entry: LibraryEntry,
  pack: Pack,
  location: EntryLocation = entry,
): LibraryEntry {
  return {
    ...entry,
    title: localize(pack.title, pack.defaultLanguage, pack.defaultLanguage),
    gameName: pack.game.name,
    version: pack.version,
    path: location.path,
    source: location.source,
    markerCount: pack.markers.length,
    status: 'available',
  };
}

export function markOpened(entry: LibraryEntry, now: string): LibraryEntry {
  return { ...entry, lastOpenedAt: now };
}

export function withStatus(entry: LibraryEntry, status: PackStatus): LibraryEntry {
  return { ...entry, status };
}

export function withPath(entry: LibraryEntry, path: string): LibraryEntry {
  return { ...entry, path };
}

/** Most recently opened first; never-opened packs by import time; ties by title. */
export function sortByRecent(entries: readonly LibraryEntry[]): LibraryEntry[] {
  const recency = (entry: LibraryEntry): number =>
    Date.parse(entry.lastOpenedAt ?? entry.importedAt);
  return [...entries].sort(
    (a, b) =>
      recency(b) - recency(a) || a.title.localeCompare(b.title) || a.packId.localeCompare(b.packId),
  );
}
