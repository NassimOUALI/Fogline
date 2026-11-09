import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { normalizeRelativePath, type PackSource } from '@fogline/pack-format';

/** Entries decompressed eagerly: the small text files the validator reads. */
const TEXT_EXTENSIONS = ['.json', '.md', '.svg'];

export interface ArchivePackSource extends PackSource {
  /** Every file path in the archive, sorted. */
  readonly entries: readonly string[];
}

/**
 * A `.fogpack` archive (a zip of the pack folder, manifest at the root).
 * The archive is read into memory once; only text entries are decompressed.
 */
export async function openArchivePackSource(file: string): Promise<ArchivePackSource> {
  const data = await readFile(file);
  const names: string[] = [];
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(data, {
      filter: (entry) => {
        if (!entry.name.endsWith('/')) {
          names.push(entry.name);
        }
        return TEXT_EXTENSIONS.some((extension) => entry.name.endsWith(extension));
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${file} is not a readable .fogpack archive (${detail}).`, { cause: error });
  }
  const present = new Set(names.map(normalizeRelativePath));
  const decoder = new TextDecoder();
  return {
    entries: [...present].sort(),
    readText(path) {
      const content = unzipped[normalizeRelativePath(path)];
      return Promise.resolve(content === undefined ? undefined : decoder.decode(content));
    },
    exists(path) {
      return Promise.resolve(present.has(normalizeRelativePath(path)));
    },
  };
}
