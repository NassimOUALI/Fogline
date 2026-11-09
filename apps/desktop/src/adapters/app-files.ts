/**
 * The few file operations the JSON stores and the pack reader need. Implemented with the Tauri
 * file plugin in the app and with Node in tests, so the same adapters run in both.
 */
export interface AppFiles {
  /** File content, or `undefined` when the file does not exist. */
  readText(path: string): Promise<string | undefined>;
  /** Creates parent folders and replaces the file atomically (write, then rename). */
  writeText(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Removes a file; a missing file is not an error. */
  remove(path: string): Promise<void>;
}

/** Joins path segments with `/`, which Windows also accepts. */
export function joinPath(...segments: string[]): string {
  return segments
    .filter((segment) => segment.length > 0)
    .map((segment, index) => {
      const trimmed = segment.replace(/[\\/]+$/, '');
      return index === 0 ? trimmed : trimmed.replace(/^[\\/]+/, '');
    })
    .join('/');
}
