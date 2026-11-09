/**
 * Read access to a pack's files. The validator only needs this, so it runs the same in Node
 * (CLI), in the Tauri webview (app) and in memory (tests).
 */
export interface PackSource {
  /** Text content of a file, or `undefined` when it does not exist. */
  readText(relativePath: string): Promise<string | undefined>;
  exists(relativePath: string): Promise<boolean>;
}

export type FileMap = Record<string, string | Uint8Array>;

/** Normalizes separators and strips a leading `./`. Does not resolve `..`. */
export function normalizeRelativePath(path: string): string {
  let out = path.replace(/\\/g, '/');
  while (out.startsWith('./')) {
    out = out.slice(2);
  }
  return out;
}

/**
 * True when the path stays inside the pack folder: relative, no `..` segments, no drive letter,
 * no leading slash.
 */
export function isSafeRelativePath(path: string): boolean {
  const normalized = normalizeRelativePath(path);
  if (normalized.length === 0) {
    return false;
  }
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    return false;
  }
  return normalized.split('/').every((segment) => segment !== '..' && segment !== '');
}

/** Joins path segments with `/`, normalizing each. */
export function joinRelativePath(...segments: string[]): string {
  return segments
    .map((segment) => normalizeRelativePath(segment).replace(/\/+$/, ''))
    .filter((segment) => segment.length > 0)
    .join('/');
}

/** A pack held entirely in memory. Used by tests and by fixtures. */
export function createMemoryPackSource(files: FileMap): PackSource {
  const normalized = new Map<string, string | Uint8Array>();
  for (const [path, content] of Object.entries(files)) {
    normalized.set(normalizeRelativePath(path), content);
  }
  return {
    readText(path) {
      const content = normalized.get(normalizeRelativePath(path));
      if (content === undefined) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(
        typeof content === 'string' ? content : new TextDecoder().decode(content),
      );
    },
    exists(path) {
      return Promise.resolve(normalized.has(normalizeRelativePath(path)));
    },
  };
}
