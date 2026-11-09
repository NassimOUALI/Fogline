import { localize } from './localized-text';
import type { Marker } from './pack';

export interface SearchResult {
  readonly marker: Marker;
  /** The marker name in the search language, for display. */
  readonly name: string;
}

export interface SearchOptions {
  /** Restrict to one map. */
  readonly mapId?: string | undefined;
  /** Default 50. */
  readonly limit?: number | undefined;
}

export const DEFAULT_SEARCH_LIMIT = 50;

/** Lower case, accents removed, whitespace collapsed: "Épée  Rare" -> "epee rare". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

interface IndexEntry {
  readonly marker: Marker;
  readonly name: string;
  readonly normalized: string;
  readonly words: readonly string[];
}

/** Rank: exact name, name prefix, word prefix, substring, all words anywhere. */
function rank(entry: IndexEntry, query: string, terms: readonly string[]): number | undefined {
  if (entry.normalized === query) {
    return 0;
  }
  if (entry.normalized.startsWith(query)) {
    return 1;
  }
  if (entry.words.some((word) => word.startsWith(query))) {
    return 2;
  }
  if (entry.normalized.includes(query)) {
    return 3;
  }
  if (terms.length > 1 && terms.every((term) => entry.normalized.includes(term))) {
    return 4;
  }
  return undefined;
}

/**
 * Search over marker names in one language. Build once per pack and language; each query
 * is a linear scan over pre-normalized names, which stays fast for tens of thousands of markers.
 */
export class MarkerSearchIndex {
  private readonly entries: readonly IndexEntry[];

  constructor(markers: readonly Marker[], language: string, defaultLanguage: string) {
    this.entries = markers.map((marker) => {
      const name = localize(marker.name, language, defaultLanguage);
      const normalized = normalizeForSearch(name);
      return { marker, name, normalized, words: normalized.split(' ') };
    });
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const normalizedQuery = normalizeForSearch(query);
    if (normalizedQuery.length === 0) {
      return [];
    }
    const terms = normalizedQuery.split(' ');
    const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
    const hits: { entry: IndexEntry; score: number }[] = [];
    for (const entry of this.entries) {
      if (options.mapId !== undefined && entry.marker.mapId !== options.mapId) {
        continue;
      }
      const score = rank(entry, normalizedQuery, terms);
      if (score !== undefined) {
        hits.push({ entry, score });
      }
    }
    hits.sort(
      (a, b) =>
        a.score - b.score ||
        a.entry.name.localeCompare(b.entry.name) ||
        a.entry.marker.id.localeCompare(b.entry.marker.id),
    );
    return hits.slice(0, limit).map(({ entry }) => ({ marker: entry.marker, name: entry.name }));
  }
}
