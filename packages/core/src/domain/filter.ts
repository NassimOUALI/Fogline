import type { CategoryTree, CollectedLookup } from './category-tree';

/**
 * Filter state, kept apart from the tree and persisted with progress.
 * `hiddenNodeIds` holds **leaf** ids (assumption A4); unknown ids are kept so a filter
 * survives a pack update that temporarily drops a category.
 */
export interface FilterState {
  readonly hiddenNodeIds: readonly string[];
  readonly hideCollected: boolean;
}

export const EMPTY_FILTER: FilterState = Object.freeze({
  hiddenNodeIds: Object.freeze([]),
  hideCollected: false,
});

/** Builds a filter with sorted, de-duplicated ids so equal filters serialize equally. */
export function createFilterState(
  hiddenNodeIds: Iterable<string>,
  hideCollected = false,
): FilterState {
  return Object.freeze({
    hiddenNodeIds: Object.freeze([...new Set(hiddenNodeIds)].sort()),
    hideCollected,
  });
}

export function hiddenSet(filter: FilterState): ReadonlySet<string> {
  return new Set(filter.hiddenNodeIds);
}

/** Expands any group ids to their leaves. Unknown ids are kept unchanged. */
export function normalizeFilter(tree: CategoryTree, filter: FilterState): FilterState {
  const leaves = filter.hiddenNodeIds.flatMap((id) => {
    const node = tree.find(id);
    return node === undefined ? [id] : node.leafIds();
  });
  return createFilterState(leaves, filter.hideCollected);
}

/** Shows or hides every leaf at or below `nodeId`. Unknown ids leave the filter unchanged. */
export function setNodeVisible(
  tree: CategoryTree,
  filter: FilterState,
  nodeId: string,
  visible: boolean,
): FilterState {
  const node = tree.find(nodeId);
  if (node === undefined) {
    return filter;
  }
  const hidden = new Set(filter.hiddenNodeIds);
  for (const leaf of node.leafIds()) {
    if (visible) {
      hidden.delete(leaf);
    } else {
      hidden.add(leaf);
    }
  }
  return createFilterState(hidden, filter.hideCollected);
}

/**
 * Checkbox click: a fully visible node becomes hidden; a hidden or mixed node becomes fully
 * visible.
 */
export function toggleNode(tree: CategoryTree, filter: FilterState, nodeId: string): FilterState {
  const node = tree.find(nodeId);
  if (node === undefined) {
    return filter;
  }
  const visible = node.visibility(hiddenSet(filter)) !== 'all';
  return setNodeVisible(tree, filter, nodeId, visible);
}

export function withHideCollected(filter: FilterState, hideCollected: boolean): FilterState {
  return createFilterState(filter.hiddenNodeIds, hideCollected);
}

/** Shows every category; keeps the hide-collected toggle. */
export function showAll(filter: FilterState): FilterState {
  return createFilterState([], filter.hideCollected);
}

export interface FilterableMarker {
  readonly id: string;
  readonly categoryId: string;
}

/** Markers whose leaf is not hidden and, when `hideCollected` is on, are not collected. */
export function applyFilter<T extends FilterableMarker>(
  markers: readonly T[],
  filter: FilterState,
  progress: CollectedLookup,
): T[] {
  const hidden = hiddenSet(filter);
  return markers.filter(
    (marker) =>
      !hidden.has(marker.categoryId) &&
      !(filter.hideCollected && Object.hasOwn(progress.collected, marker.id)),
  );
}
