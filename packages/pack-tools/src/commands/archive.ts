import { closeSync, openSync, readFileSync, statSync, writeSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { validatePack } from '@fogline/pack-format';
import { CliError, EXIT_FAILURE, EXIT_OK, formatBytes, type CliIO } from '../io';
import { createFolderPackSource, listFiles } from '../sources/folder-source';
import { printValidationReport } from './validate';

/** Already-compressed formats are stored, not deflated (docs/02). */
const STORED_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.avif', '.pmtiles'];

/** Fixed entry timestamp so the same folder always produces the same archive bytes. */
export const ARCHIVE_ENTRY_TIME = new Date('2026-01-01T00:00:00Z');

/** True when `child` lies inside the folder `parent` (different drives are never inside). */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export function isStoredEntry(path: string): boolean {
  const lower = path.toLowerCase();
  return STORED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export interface ArchiveResult {
  readonly files: number;
  readonly stored: number;
  readonly bytes: number;
}

/**
 * Writes `files` (relative to `packDir`) into a zip at `outFile`, streaming one file at a time
 * so memory use stays bounded by the largest file.
 */
export function writeArchive(
  packDir: string,
  files: readonly string[],
  outFile: string,
): ArchiveResult {
  const fd = openSync(outFile, 'w');
  let failure: Error | undefined;
  let stored = 0;
  try {
    const zip = new Zip((error, chunk) => {
      if (error !== null) {
        failure = error;
        return;
      }
      writeSync(fd, chunk);
    });
    for (const file of files) {
      const entry = isStoredEntry(file)
        ? new ZipPassThrough(file)
        : new ZipDeflate(file, { level: 6 });
      entry.mtime = ARCHIVE_ENTRY_TIME;
      if (isStoredEntry(file)) {
        stored += 1;
      }
      zip.add(entry);
      entry.push(readFileSync(join(packDir, file)), true);
    }
    zip.end();
  } finally {
    closeSync(fd);
  }
  if (failure !== undefined) {
    throw failure;
  }
  return { files: files.length, stored, bytes: statSync(outFile).size };
}

/**
 * `fogline-pack archive <packDir> <out.fogpack>`: validates the folder, refuses on errors, then
 * writes the archive with the manifest at its root.
 */
export async function runArchive(io: CliIO, packDir: string, outFile: string): Promise<number> {
  let isDirectory = false;
  try {
    isDirectory = statSync(packDir).isDirectory();
  } catch {
    // reported below
  }
  if (!isDirectory) {
    throw new CliError(`Not a pack folder: ${packDir}`);
  }
  if (isInside(packDir, outFile)) {
    throw new CliError('Write the archive outside the pack folder, or it would include itself.');
  }

  const result = await validatePack(createFolderPackSource(packDir));
  if (!result.ok) {
    printValidationReport(io, packDir, result);
    io.err('Archive not written: fix the errors above first.');
    return EXIT_FAILURE;
  }

  const files = await listFiles(packDir);
  await mkdir(dirname(resolve(outFile)), { recursive: true });
  try {
    const archive = writeArchive(packDir, files, outFile);
    io.out(
      `Wrote ${outFile}: ${String(archive.files)} files (${String(archive.stored)} stored uncompressed), ${formatBytes(archive.bytes)}.`,
    );
  } catch (error) {
    await rm(outFile, { force: true });
    throw error;
  }
  if (result.warnings.length > 0) {
    io.out(`${String(result.warnings.length)} validation warning(s); run validate for details.`);
  }
  return EXIT_OK;
}
