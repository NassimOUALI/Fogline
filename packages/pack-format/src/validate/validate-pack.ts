import type { z } from 'zod';
import { deltaE76 } from '../color/contrast';
import { normalizePalette } from '../color/palette';
import { migrateManifest } from '../migrations';
import {
  categoriesFileSchema,
  MAX_CATEGORY_DEPTH,
  type CategoryNodeData,
} from '../schemas/categories';
import { manifestSchema, type Manifest, type MapEntry } from '../schemas/manifest';
import { markersFileSchema, type Marker } from '../schemas/markers';
import { nativeZoomFor, sampleTileCoordinates, tileGridAt, tilePath } from './geometry';
import { formatPath, ISSUE_CODES, IssueCollector, type ValidationIssue } from './issues';
import { isSafeRelativePath, joinRelativePath, type PackSource } from './pack-source';

export const MANIFEST_FILE = 'manifest.json';
export const ARTICLES_FOLDER = 'data/articles';
/** Sibling category colors closer than this (CIE76) are flagged (assumption A9). */
export const SIMILAR_COLOR_DELTA_E = 15;

export interface ValidatePackOptions {
  /**
   * `check` (default) verifies that referenced files exist and samples tiles.
   * `skip` runs only the pure schema and semantic checks (assumption A2).
   */
  files?: 'check' | 'skip';
  /** Tile file extension, default `webp`. */
  tileExtension?: string;
}

/** The parsed pack data, available when every data file parsed. */
export interface ParsedPack {
  manifest: Manifest;
  categories: CategoryNodeData[];
  /** Map id to its markers. */
  markers: Record<string, Marker[]>;
}

export interface ValidationResult {
  /** True when there are no errors. Warnings do not affect it. */
  ok: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  pack?: ParsedPack;
}

interface CategoryIndex {
  ids: Set<string>;
  leafIds: Set<string>;
  /** Icon paths with the node path that declared them. */
  icons: { path: string; at: string }[];
}

export async function validatePack(
  source: PackSource,
  options: ValidatePackOptions = {},
): Promise<ValidationResult> {
  const shouldCheckFiles = (options.files ?? 'check') === 'check';
  const tileExtension = options.tileExtension ?? 'webp';
  const issues = new IssueCollector();

  const rawManifest = await readJson(source, MANIFEST_FILE, 'manifest', issues);
  if (rawManifest === undefined) {
    return finish(issues);
  }
  const migrated = migrateManifest(rawManifest);
  if (!migrated.ok) {
    issues.error(migrated.code, 'manifest.formatVersion', migrated.message);
    return finish(issues);
  }
  const manifest = parseWith(manifestSchema, migrated.manifest, 'manifest', issues);
  if (manifest === undefined) {
    return finish(issues);
  }

  checkManifestSemantics(manifest, issues);
  const mapsById = new Map(manifest.maps.map((map) => [map.id, map]));

  const index: CategoryIndex = { ids: new Set(), leafIds: new Set(), icons: [] };
  let categories: CategoryNodeData[] | undefined;
  if (isSafeRelativePath(manifest.categories)) {
    const raw = await readJson(source, manifest.categories, 'categories', issues);
    if (raw !== undefined) {
      categories = parseWith(categoriesFileSchema, raw, 'categories', issues);
      if (categories !== undefined) {
        checkCategoryTree(categories, index, issues);
      }
    }
  }

  const markers: Record<string, Marker[]> = {};
  const seenMarkerIds = new Map<string, string>();
  let allMarkersParsed = true;
  for (const [mapId, path] of Object.entries(manifest.markers)) {
    const map = mapsById.get(mapId);
    if (map === undefined || !isSafeRelativePath(path)) {
      allMarkersParsed = false;
      continue; // already reported by checkManifestSemantics
    }
    const prefix = `markers.${mapId}`;
    const raw = await readJson(source, path, prefix, issues);
    const list = raw === undefined ? undefined : parseWith(markersFileSchema, raw, prefix, issues);
    if (list === undefined) {
      allMarkersParsed = false;
      continue;
    }
    markers[mapId] = list;
    checkMarkers(
      list,
      map,
      prefix,
      categories !== undefined ? index : undefined,
      seenMarkerIds,
      issues,
    );
  }

  checkPalette(manifest, issues);

  if (shouldCheckFiles) {
    await checkReferencedFiles(source, manifest, index, markers, tileExtension, issues);
  }

  const pack =
    categories !== undefined && allMarkersParsed ? { manifest, categories, markers } : undefined;
  return finish(issues, pack);
}

function finish(issues: IssueCollector, pack?: ParsedPack): ValidationResult {
  const all = issues.issues;
  const result: ValidationResult = {
    ok: !issues.hasErrors,
    issues: all,
    errors: all.filter((issue) => issue.severity === 'error'),
    warnings: all.filter((issue) => issue.severity === 'warning'),
  };
  if (pack !== undefined) {
    result.pack = pack;
  }
  return result;
}

async function readJson(
  source: PackSource,
  path: string,
  prefix: string,
  issues: IssueCollector,
): Promise<unknown> {
  const text = await source.readText(path);
  if (text === undefined) {
    issues.error(ISSUE_CODES.fileMissing, prefix, `File not found: ${path}`);
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    issues.error(ISSUE_CODES.jsonInvalid, prefix, `${path} is not valid JSON: ${detail}`);
    return undefined;
  }
}

function parseWith<T>(
  schema: z.ZodType<T>,
  data: unknown,
  prefix: string,
  issues: IssueCollector,
): T | undefined {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  for (const issue of result.error.issues) {
    issues.error(ISSUE_CODES.schemaInvalid, formatPath(prefix, issue.path), issue.message);
  }
  return undefined;
}

function checkManifestSemantics(manifest: Manifest, issues: IssueCollector): void {
  const checkPath = (path: string, at: string): void => {
    if (!isSafeRelativePath(path)) {
      issues.error(ISSUE_CODES.pathEscapes, at, `Path must stay inside the pack folder: ${path}`);
    }
  };

  checkPath(manifest.categories, 'manifest.categories');

  const seenMapIds = new Set<string>();
  manifest.maps.forEach((map, i) => {
    const at = `manifest.maps[${String(i)}]`;
    if (seenMapIds.has(map.id)) {
      issues.error(ISSUE_CODES.mapDuplicateId, `${at}.id`, `Duplicate map id "${map.id}".`);
    }
    seenMapIds.add(map.id);
    checkPath(map.tiles.path, `${at}.tiles.path`);
    if (map.thumbnail !== undefined) {
      checkPath(map.thumbnail, `${at}.thumbnail`);
    }
    const expectedZoom = nativeZoomFor(map.size, map.tileSize);
    if (map.maxZoom !== expectedZoom) {
      issues.warning(
        ISSUE_CODES.mapZoomMismatch,
        `${at}.maxZoom`,
        `maxZoom is ${String(map.maxZoom)} but a ${String(map.size.width)}x${String(map.size.height)} ` +
          `image with ${String(map.tileSize)}px tiles has native zoom ${String(expectedZoom)}.`,
      );
    }
    if (!(map.id in manifest.markers)) {
      issues.warning(
        ISSUE_CODES.mapNoMarkers,
        at,
        `Map "${map.id}" has no entry in manifest.markers; it will show no markers.`,
      );
    }
  });

  for (const [mapId, path] of Object.entries(manifest.markers)) {
    const at = `manifest.markers.${mapId}`;
    if (!seenMapIds.has(mapId)) {
      issues.error(
        ISSUE_CODES.markersUnknownMap,
        at,
        `manifest.markers references map "${mapId}", which is not declared in manifest.maps.`,
      );
    }
    checkPath(path, at);
  }
}

function checkCategoryTree(
  nodes: CategoryNodeData[],
  index: CategoryIndex,
  issues: IssueCollector,
): void {
  const visit = (siblings: CategoryNodeData[], prefix: string, depth: number): void => {
    siblings.forEach((node, i) => {
      const at = `${prefix}[${String(i)}]`;
      if (index.ids.has(node.id)) {
        issues.error(
          ISSUE_CODES.categoryDuplicateId,
          `${at}.id`,
          `Duplicate category id "${node.id}".`,
        );
      }
      index.ids.add(node.id);
      if (node.icon !== undefined) {
        if (isSafeRelativePath(node.icon)) {
          index.icons.push({ path: node.icon, at: `${at}.icon` });
        } else {
          issues.error(
            ISSUE_CODES.pathEscapes,
            `${at}.icon`,
            `Path must stay inside the pack folder: ${node.icon}`,
          );
        }
      }
      if (depth > MAX_CATEGORY_DEPTH) {
        issues.error(
          ISSUE_CODES.categoryTooDeep,
          at,
          `Category "${node.id}" is nested ${String(depth)} levels deep; the maximum is ${String(MAX_CATEGORY_DEPTH)}.`,
        );
        return; // do not descend further; one report per offending branch
      }
      if (node.children === undefined) {
        index.leafIds.add(node.id);
        return;
      }
      if (node.children.length === 0) {
        issues.warning(
          ISSUE_CODES.categoryEmptyGroup,
          `${at}.children`,
          `Group "${node.id}" has no children.`,
        );
      }
      visit(node.children, `${at}.children`, depth + 1);
    });
    checkSiblingColors(siblings, prefix, issues);
  };
  visit(nodes, 'categories', 1);
}

function checkSiblingColors(
  siblings: CategoryNodeData[],
  prefix: string,
  issues: IssueCollector,
): void {
  const colored = siblings
    .map((node, i) => ({ node, i }))
    .filter(
      (entry): entry is { node: CategoryNodeData & { color: string }; i: number } =>
        entry.node.color !== undefined,
    );
  for (let a = 0; a < colored.length; a += 1) {
    for (let b = a + 1; b < colored.length; b += 1) {
      const first = colored[a];
      const second = colored[b];
      if (first === undefined || second === undefined) {
        continue;
      }
      const distance = deltaE76(first.node.color, second.node.color);
      if (distance < SIMILAR_COLOR_DELTA_E) {
        issues.warning(
          ISSUE_CODES.categorySimilarColors,
          `${prefix}[${String(second.i)}].color`,
          `Sibling categories "${first.node.id}" (${first.node.color}) and "${second.node.id}" ` +
            `(${second.node.color}) are hard to tell apart (delta E ${distance.toFixed(1)}).`,
        );
      }
    }
  }
}

function checkMarkers(
  markers: Marker[],
  map: MapEntry,
  prefix: string,
  categories: CategoryIndex | undefined,
  seenIds: Map<string, string>,
  issues: IssueCollector,
): void {
  markers.forEach((marker, i) => {
    const at = `${prefix}[${String(i)}]`;
    const firstSeen = seenIds.get(marker.id);
    if (firstSeen !== undefined) {
      issues.error(
        ISSUE_CODES.markerDuplicateId,
        `${at}.id`,
        `Duplicate marker id "${marker.id}" (first seen at ${firstSeen}).`,
      );
    } else {
      seenIds.set(marker.id, at);
    }
    if (categories !== undefined) {
      if (!categories.ids.has(marker.category)) {
        issues.error(
          ISSUE_CODES.markerUnknownCategory,
          `${at}.category`,
          `Marker "${marker.id}" references unknown category "${marker.category}".`,
        );
      } else if (!categories.leafIds.has(marker.category)) {
        issues.error(
          ISSUE_CODES.markerCategoryNotLeaf,
          `${at}.category`,
          `Marker "${marker.id}" references group "${marker.category}"; markers must use leaf categories.`,
        );
      }
    }
    const { x, y } = marker.position;
    if (x < 0 || y < 0 || x > map.size.width || y > map.size.height) {
      issues.warning(
        ISSUE_CODES.markerOutOfBounds,
        `${at}.position`,
        `Marker "${marker.id}" at (${String(x)}, ${String(y)}) is outside map "${map.id}" ` +
          `(${String(map.size.width)}x${String(map.size.height)}).`,
      );
    }
  });
}

function checkPalette(manifest: Manifest, issues: IssueCollector): void {
  const palette = manifest.theme?.palette;
  if (palette === undefined) {
    return;
  }
  const { adjustments } = normalizePalette(palette);
  for (const adjustment of adjustments) {
    const supplied = palette[adjustment.token] !== undefined;
    const origin = supplied ? adjustment.from : `app default ${adjustment.from}`;
    issues.warning(
      ISSUE_CODES.paletteContrast,
      `manifest.theme.palette.${adjustment.token}`,
      `${adjustment.token} (${origin}) on ${adjustment.against.join(' and ')} has contrast ` +
        `${adjustment.actual.toFixed(2)}:1; the minimum is ${String(adjustment.minimum)}:1. ` +
        `The app will use ${adjustment.to} instead.`,
    );
  }
}

async function checkReferencedFiles(
  source: PackSource,
  manifest: Manifest,
  index: CategoryIndex,
  markers: Record<string, Marker[]>,
  tileExtension: string,
  issues: IssueCollector,
): Promise<void> {
  const requireFile = async (path: string, at: string): Promise<void> => {
    if (!(await source.exists(path))) {
      issues.error(ISSUE_CODES.fileMissing, at, `File not found: ${path}`);
    }
  };

  for (const icon of index.icons) {
    await requireFile(icon.path, icon.at);
  }

  for (const [i, map] of manifest.maps.entries()) {
    const at = `manifest.maps[${String(i)}]`;
    if (map.thumbnail !== undefined && isSafeRelativePath(map.thumbnail)) {
      await requireFile(map.thumbnail, `${at}.thumbnail`);
    }
    if (!isSafeRelativePath(map.tiles.path)) {
      continue;
    }
    if (map.tiles.type === 'pmtiles') {
      await requireFile(map.tiles.path, `${at}.tiles.path`);
      continue;
    }
    for (let zoom = map.minZoom; zoom <= map.maxZoom; zoom += 1) {
      const grid = tileGridAt(map, zoom);
      const missing: string[] = [];
      for (const tile of sampleTileCoordinates(grid)) {
        const path = tilePath(map.tiles.path, tile, tileExtension);
        if (!(await source.exists(path))) {
          missing.push(path);
        }
      }
      if (missing.length > 0) {
        issues.error(
          ISSUE_CODES.tilesMissing,
          `${at}.tiles`,
          `Map "${map.id}" zoom ${String(zoom)}: sampled tiles are missing (${missing.join(', ')}).`,
        );
      }
    }
  }

  for (const [mapId, list] of Object.entries(markers)) {
    for (const [i, marker] of list.entries()) {
      if (marker.article !== undefined) {
        const path = joinRelativePath(ARTICLES_FOLDER, `${marker.article}.md`);
        await requireFile(path, `markers.${mapId}[${String(i)}].article`);
      }
    }
  }
}
