/** Test-only helpers: load on-disk fixtures and the repository examples into memory. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FileMap } from '../src/validate/pack-source';

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url));
export const EXAMPLES_DIR = fileURLToPath(new URL('../../../examples/', import.meta.url));

/** Reads a folder recursively into a `FileMap` keyed by forward-slash relative paths. */
export function readDirAsFileMap(dir: string): FileMap {
  const files: FileMap = {};
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const key = relative(dir, full).replace(/\\/g, '/');
        files[key] = readFileSync(full, 'utf8');
      }
    }
  };
  walk(dir);
  return files;
}

export function loadFixture(name: string): FileMap {
  return readDirAsFileMap(join(FIXTURES_DIR, name));
}

export function loadExamplePack(): FileMap {
  return readDirAsFileMap(join(EXAMPLES_DIR, 'pack'));
}

export function readExampleJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(EXAMPLES_DIR, relativePath), 'utf8')) as unknown;
}
