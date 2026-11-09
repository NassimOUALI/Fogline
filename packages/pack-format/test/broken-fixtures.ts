/**
 * Deliberately broken packs, each derived from the valid fixture with exactly one defect.
 * Shared by the validator tests now and by the CLI tests in Stage 4.
 */
import { ISSUE_CODES, type IssueCode, type Severity } from '../src/validate/issues';
import type { FileMap } from '../src/validate/pack-source';

export interface BrokenFixture {
  name: string;
  code: IssueCode;
  severity: Severity;
  /** Some defects only make sense without file checks (see each case). */
  files?: 'check' | 'skip';
  build(valid: FileMap): FileMap;
}

type Json = Record<string, unknown>;

function editJson(files: FileMap, path: string, edit: (data: Json) => void): FileMap {
  const text = files[path];
  if (typeof text !== 'string') {
    throw new Error(`Fixture has no text file at ${path}`);
  }
  const data = JSON.parse(text) as Json;
  edit(data);
  return { ...files, [path]: JSON.stringify(data, null, 2) };
}

function editJsonArray(files: FileMap, path: string, edit: (data: Json[]) => void): FileMap {
  const text = files[path];
  if (typeof text !== 'string') {
    throw new Error(`Fixture has no text file at ${path}`);
  }
  const data = JSON.parse(text) as Json[];
  edit(data);
  return { ...files, [path]: JSON.stringify(data, null, 2) };
}

function without(files: FileMap, path: string): FileMap {
  return Object.fromEntries(Object.entries(files).filter(([key]) => key !== path));
}

function at<T>(list: T[], i: number): T {
  const item = list[i];
  if (item === undefined) {
    throw new Error(`Fixture expected an element at index ${String(i)}`);
  }
  return item;
}

const MANIFEST = 'manifest.json';
const CATEGORIES = 'data/categories.json';
const MARKERS = 'data/markers/main.json';

function node(id: string, extra: Json = {}): Json {
  return { id, name: { en: id }, ...extra };
}

export const BROKEN_FIXTURES: readonly BrokenFixture[] = [
  {
    name: 'missing-manifest',
    code: ISSUE_CODES.fileMissing,
    severity: 'error',
    build: (valid) => without(valid, MANIFEST),
  },
  {
    name: 'invalid-json',
    code: ISSUE_CODES.jsonInvalid,
    severity: 'error',
    build: (valid) => ({ ...valid, [CATEGORIES]: '{ "not": json' }),
  },
  {
    name: 'unsupported-format-version',
    code: ISSUE_CODES.formatUnsupportedVersion,
    severity: 'error',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        m.formatVersion = 99;
      }),
  },
  {
    name: 'missing-license',
    code: ISSUE_CODES.schemaInvalid,
    severity: 'error',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        delete m.license;
      }),
  },
  {
    name: 'path-escapes',
    code: ISSUE_CODES.pathEscapes,
    severity: 'error',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        m.categories = '../outside/categories.json';
      }),
  },
  {
    name: 'markers-unknown-map',
    code: ISSUE_CODES.markersUnknownMap,
    severity: 'error',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        (m.markers as Json).ghost = MARKERS;
      }),
  },
  {
    name: 'map-duplicate-id',
    code: ISSUE_CODES.mapDuplicateId,
    severity: 'error',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        const maps = m.maps as Json[];
        maps.push({ ...at(maps, 0) });
      }),
  },
  {
    name: 'map-no-markers',
    code: ISSUE_CODES.mapNoMarkers,
    severity: 'warning',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        const maps = m.maps as Json[];
        const first: Json = { ...at(maps, 0), id: 'extra', order: 2 };
        delete first.thumbnail;
        maps.push(first);
      }),
  },
  {
    name: 'map-zoom-mismatch',
    code: ISSUE_CODES.mapZoomMismatch,
    severity: 'warning',
    files: 'skip',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        at(m.maps as Json[], 0).maxZoom = 3;
      }),
  },
  {
    name: 'duplicate-category-id',
    code: ISSUE_CODES.categoryDuplicateId,
    severity: 'error',
    build: (valid) =>
      editJsonArray(valid, CATEGORIES, (nodes) => {
        (at(nodes, 0).children as Json[]).push(node('camps', { color: '#ff00ff' }));
      }),
  },
  {
    name: 'category-too-deep',
    code: ISSUE_CODES.categoryTooDeep,
    severity: 'error',
    build: (valid) =>
      editJsonArray(valid, CATEGORIES, (nodes) => {
        let leaf: Json = node('deep-7');
        for (let depth = 6; depth >= 1; depth -= 1) {
          leaf = node(`deep-${String(depth)}`, { children: [leaf] });
        }
        nodes.push(leaf);
      }),
  },
  {
    name: 'category-empty-group',
    code: ISSUE_CODES.categoryEmptyGroup,
    severity: 'warning',
    build: (valid) =>
      editJsonArray(valid, CATEGORIES, (nodes) => {
        nodes.push(node('empty', { children: [] }));
      }),
  },
  {
    name: 'similar-sibling-colors',
    code: ISSUE_CODES.categorySimilarColors,
    severity: 'warning',
    build: (valid) =>
      editJsonArray(valid, CATEGORIES, (nodes) => {
        const children = at(nodes, 0).children as Json[];
        at(children, 0).color = '#9aa3ad';
        at(children, 1).color = '#9ba4ae';
      }),
  },
  {
    name: 'duplicate-marker-id',
    code: ISSUE_CODES.markerDuplicateId,
    severity: 'error',
    build: (valid) =>
      editJsonArray(valid, MARKERS, (markers) => {
        at(markers, 1).id = at(markers, 0).id;
      }),
  },
  {
    name: 'marker-unknown-category',
    code: ISSUE_CODES.markerUnknownCategory,
    severity: 'error',
    build: (valid) =>
      editJsonArray(valid, MARKERS, (markers) => {
        at(markers, 0).category = 'does-not-exist';
      }),
  },
  {
    name: 'marker-category-not-leaf',
    code: ISSUE_CODES.markerCategoryNotLeaf,
    severity: 'error',
    build: (valid) =>
      editJsonArray(valid, MARKERS, (markers) => {
        at(markers, 0).category = 'loot';
      }),
  },
  {
    name: 'marker-out-of-bounds',
    code: ISSUE_CODES.markerOutOfBounds,
    severity: 'warning',
    build: (valid) =>
      editJsonArray(valid, MARKERS, (markers) => {
        at(markers, 0).position = { x: 9999, y: 10 };
      }),
  },
  {
    name: 'missing-icon-file',
    code: ISSUE_CODES.fileMissing,
    severity: 'error',
    build: (valid) => without(valid, 'icons/camp.svg'),
  },
  {
    name: 'missing-article-file',
    code: ISSUE_CODES.fileMissing,
    severity: 'error',
    build: (valid) => without(valid, 'data/articles/notes.md'),
  },
  {
    name: 'tiles-missing',
    code: ISSUE_CODES.tilesMissing,
    severity: 'error',
    build: (valid) => without(valid, 'maps/main/tiles/1/1/1.webp'),
  },
  {
    name: 'palette-low-contrast',
    code: ISSUE_CODES.paletteContrast,
    severity: 'warning',
    build: (valid) =>
      editJson(valid, MANIFEST, (m) => {
        ((m.theme as Json).palette as Json).text = '#333333';
      }),
  },
];
