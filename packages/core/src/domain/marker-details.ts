import type { CategoryTree } from './category-tree';
import { localize } from './localized-text';
import { findMap, findMarker, type Pack, type Position } from './pack';
import { collectedAt, type Progress } from './progress';

export const ARTICLES_FOLDER = 'data/articles';

export interface MarkerAttributeView {
  readonly key: string;
  readonly label: string;
  /** Text is localized; numbers and booleans are left for the UI to format. */
  readonly value: string | number | boolean;
}

export interface MarkerDetails {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly mapId: string;
  readonly mapName: string;
  readonly position: Position;
  readonly category: {
    readonly id: string;
    readonly name: string;
    /** Group names from the root down, e.g. ["Collectibles", "Shrines"]. */
    readonly path: readonly string[];
    readonly color?: string | undefined;
    readonly icon?: string | undefined;
  };
  readonly attributes: readonly MarkerAttributeView[];
  readonly article?: { readonly id: string; readonly path: string } | undefined;
  readonly collected: boolean;
  readonly collectedAt?: string | undefined;
}

/** Everything the detail panel shows, resolved for `language`. */
export function describeMarker(
  pack: Pack,
  tree: CategoryTree,
  markerId: string,
  progress: Progress,
  language: string,
): MarkerDetails | undefined {
  const marker = findMarker(pack, markerId);
  if (marker === undefined) {
    return undefined;
  }
  const text = (value: Parameters<typeof localize>[0]): string =>
    localize(value, language, pack.defaultLanguage);
  const category = tree.find(marker.categoryId);
  const style = tree.styleOf(marker.categoryId);
  const at = collectedAt(progress, marker.id);
  return {
    id: marker.id,
    name: text(marker.name),
    description: marker.description === undefined ? undefined : text(marker.description),
    mapId: marker.mapId,
    mapName: text(findMap(pack, marker.mapId)?.name),
    position: marker.position,
    category: {
      id: marker.categoryId,
      name: category === undefined ? marker.categoryId : text(category.name),
      path: tree.ancestorsOf(marker.categoryId).map((node) => text(node.name)),
      color: style.color,
      icon: style.icon,
    },
    attributes: marker.attributes.map((attribute) => ({
      key: attribute.key,
      label: text(attribute.label),
      value:
        typeof attribute.value === 'number' || typeof attribute.value === 'boolean'
          ? attribute.value
          : text(attribute.value),
    })),
    article:
      marker.articleId === undefined
        ? undefined
        : { id: marker.articleId, path: `${ARTICLES_FOLDER}/${marker.articleId}.md` },
    collected: at !== undefined,
    collectedAt: at,
  };
}
