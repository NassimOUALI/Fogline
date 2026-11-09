import { CategoryTree } from '../../domain/category-tree';
import { applyFilter, hiddenSet, normalizeFilter, type FilterState } from '../../domain/filter';
import { describeMarker, type MarkerDetails } from '../../domain/marker-details';
import { findMap, markersOnMap, type Marker, type Pack } from '../../domain/pack';
import { MY_MARKERS_ID, personalMarkersCategory } from '../../domain/personal-markers';
import type { CustomMarker, Progress } from '../../domain/progress';
import { fail, ok, type Result } from '../../domain/result';
import { MarkerSearchIndex, type SearchOptions, type SearchResult } from '../../domain/search';

/**
 * Builds the filter tree for one map (counts are per map), or for the whole pack when
 * `mapId` is omitted. With `progress`, adds the built-in "My markers" leaf for that map.
 */
export class BuildCategoryTree {
  execute(input: {
    readonly pack: Pack;
    readonly mapId?: string | undefined;
    readonly progress?: Progress | undefined;
  }): Result<CategoryTree> {
    const { pack, mapId, progress } = input;
    if (mapId !== undefined && findMap(pack, mapId) === undefined) {
      return fail('map.notFound', `Map "${mapId}" is not in pack "${pack.id}".`);
    }
    const markers = mapId === undefined ? pack.markers : markersOnMap(pack, mapId);
    const extra =
      progress !== undefined && mapId !== undefined
        ? [personalMarkersCategory(progress.customMarkers, mapId)]
        : [];
    return ok(CategoryTree.fromData(pack.categories, markers, extra));
  }
}

export interface VisibleMarkers {
  readonly markers: readonly Marker[];
  readonly customMarkers: readonly CustomMarker[];
  /** The filter with group ids expanded to leaves; persist this one. */
  readonly filter: FilterState;
}

/** The markers and personal pins of one map that pass the filter. */
export class ApplyFilter {
  execute(input: {
    readonly pack: Pack;
    readonly tree: CategoryTree;
    readonly mapId: string;
    readonly filter: FilterState;
    readonly progress: Progress;
  }): VisibleMarkers {
    const filter = normalizeFilter(input.tree, input.filter);
    const markers = applyFilter(markersOnMap(input.pack, input.mapId), filter, input.progress);
    const customMarkers = hiddenSet(filter).has(MY_MARKERS_ID)
      ? []
      : input.progress.customMarkers.filter((marker) => marker.map === input.mapId);
    return { markers, customMarkers, filter };
  }
}

/** Searches marker names across the pack. Indexes are built once per pack and language. */
export class SearchMarkers {
  private readonly indexes = new WeakMap<Pack, Map<string, MarkerSearchIndex>>();

  execute(input: {
    readonly pack: Pack;
    readonly query: string;
    readonly language: string;
    readonly options?: SearchOptions | undefined;
  }): SearchResult[] {
    return this.indexFor(input.pack, input.language).search(input.query, input.options);
  }

  private indexFor(pack: Pack, language: string): MarkerSearchIndex {
    let byLanguage = this.indexes.get(pack);
    if (byLanguage === undefined) {
      byLanguage = new Map();
      this.indexes.set(pack, byLanguage);
    }
    let index = byLanguage.get(language);
    if (index === undefined) {
      index = new MarkerSearchIndex(pack.markers, language, pack.defaultLanguage);
      byLanguage.set(language, index);
    }
    return index;
  }
}

/** Data for the marker detail panel. */
export class GetMarkerDetails {
  execute(input: {
    readonly pack: Pack;
    readonly tree: CategoryTree;
    readonly markerId: string;
    readonly progress: Progress;
    readonly language: string;
  }): Result<MarkerDetails> {
    const details = describeMarker(
      input.pack,
      input.tree,
      input.markerId,
      input.progress,
      input.language,
    );
    if (details === undefined) {
      return fail(
        'marker.notFound',
        `Marker "${input.markerId}" is not in pack "${input.pack.id}".`,
      );
    }
    return ok(details);
  }
}
