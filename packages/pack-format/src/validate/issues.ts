export type Severity = 'error' | 'warning';

export const ISSUE_CODES = {
  schemaInvalid: 'schema.invalid',
  jsonInvalid: 'json.invalid',
  formatUnsupportedVersion: 'format.unsupportedVersion',
  formatInvalidVersion: 'format.invalidVersion',
  fileMissing: 'file.missing',
  pathEscapes: 'path.escapes',
  mapDuplicateId: 'map.duplicateId',
  mapNoMarkers: 'map.noMarkers',
  mapZoomMismatch: 'map.zoomMismatch',
  markersUnknownMap: 'markers.unknownMap',
  categoryDuplicateId: 'category.duplicateId',
  categoryTooDeep: 'category.tooDeep',
  categoryEmptyGroup: 'category.emptyGroup',
  categorySimilarColors: 'category.similarColors',
  markerDuplicateId: 'marker.duplicateId',
  markerUnknownCategory: 'marker.unknownCategory',
  markerCategoryNotLeaf: 'marker.categoryNotLeaf',
  markerOutOfBounds: 'marker.outOfBounds',
  tilesMissing: 'tiles.missing',
  paletteContrast: 'palette.contrast',
} as const;

export type IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES];

export interface ValidationIssue {
  severity: Severity;
  /** Dotted path such as `manifest.maps[0].tiles.path` or `markers.overworld[3].category`. */
  path: string;
  code: IssueCode;
  message: string;
}

/** Collects issues; keeps the validator functions free of array plumbing. */
export class IssueCollector {
  readonly issues: ValidationIssue[] = [];

  error(code: IssueCode, path: string, message: string): void {
    this.issues.push({ severity: 'error', code, path, message });
  }

  warning(code: IssueCode, path: string, message: string): void {
    this.issues.push({ severity: 'warning', code, path, message });
  }

  get hasErrors(): boolean {
    return this.issues.some((issue) => issue.severity === 'error');
  }
}

/** Formats a Zod-style path (`['maps', 0, 'id']`) under a prefix: `manifest.maps[0].id`. */
export function formatPath(prefix: string, segments: readonly PropertyKey[]): string {
  let out = prefix;
  for (const segment of segments) {
    if (typeof segment === 'number') {
      out += `[${String(segment)}]`;
    } else {
      out += out.length > 0 ? `.${String(segment)}` : String(segment);
    }
  }
  return out;
}
