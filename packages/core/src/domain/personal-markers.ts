import { Category } from './category-tree';
import type { CustomMarker } from './progress';

/**
 * Id of the built-in "My markers" leaf. Pack ids cannot start with `_` (the id grammar rejects
 * it), so this never collides with a pack category.
 */
export const MY_MARKERS_ID = '_my-markers';

/** Default label; the UI may translate it by checking `MY_MARKERS_ID`. */
export const MY_MARKERS_LABEL = 'My markers';

/** The "My markers" leaf for the personal pins on one map. */
export function personalMarkersCategory(
  customMarkers: readonly CustomMarker[],
  mapId: string,
): Category {
  return new Category({
    id: MY_MARKERS_ID,
    name: MY_MARKERS_LABEL,
    markerIds: customMarkers.filter((marker) => marker.map === mapId).map((marker) => marker.id),
  });
}

export const MAX_PERSONAL_MARKER_NAME = 200;
export const MAX_PERSONAL_MARKER_NOTE = 2000;
