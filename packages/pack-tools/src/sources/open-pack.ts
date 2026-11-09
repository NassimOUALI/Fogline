import { stat } from 'node:fs/promises';
import type { PackSource } from '@fogline/pack-format';
import { CliError } from '../io';
import { openArchivePackSource } from './archive-source';
import { createFolderPackSource, listFiles } from './folder-source';

export const ARCHIVE_EXTENSION = '.fogpack';

export interface OpenedSource {
  readonly kind: 'folder' | 'archive';
  readonly source: PackSource;
  /** Every file in the pack, as sorted relative paths. */
  listFiles(): Promise<readonly string[]>;
}

/** Opens a pack folder or a `.fogpack` archive. */
export async function openPack(path: string): Promise<OpenedSource> {
  let isDirectory: boolean;
  try {
    isDirectory = (await stat(path)).isDirectory();
  } catch {
    throw new CliError(`Path not found: ${path}`);
  }
  if (isDirectory) {
    return {
      kind: 'folder',
      source: createFolderPackSource(path),
      listFiles: () => listFiles(path),
    };
  }
  if (path.toLowerCase().endsWith(ARCHIVE_EXTENSION) || path.toLowerCase().endsWith('.zip')) {
    try {
      const archive = await openArchivePackSource(path);
      return {
        kind: 'archive',
        source: archive,
        listFiles: () => Promise.resolve(archive.entries),
      };
    } catch (error) {
      throw new CliError(error instanceof Error ? error.message : String(error));
    }
  }
  throw new CliError(`Expected a pack folder or a ${ARCHIVE_EXTENSION} archive: ${path}`);
}
