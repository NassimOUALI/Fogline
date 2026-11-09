import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { isSafeRelativePath, type PackSource } from '@fogline/pack-format';

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

/** A pack folder on disk. Paths that would escape the folder are treated as missing. */
export function createFolderPackSource(root: string): PackSource {
  return {
    async readText(path) {
      if (!isSafeRelativePath(path)) {
        return undefined;
      }
      try {
        return await readFile(join(root, path), 'utf8');
      } catch (error) {
        if (isNotFound(error)) {
          return undefined;
        }
        throw error;
      }
    },
    async exists(path) {
      if (!isSafeRelativePath(path)) {
        return false;
      }
      try {
        await stat(join(root, path));
        return true;
      } catch (error) {
        if (isNotFound(error)) {
          return false;
        }
        throw error;
      }
    },
  };
}

/** Files that operating systems drop into folders; never part of a pack. */
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** Every file below `root`, as sorted forward-slash relative paths. */
export async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !IGNORED_NAMES.has(entry.name))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}
