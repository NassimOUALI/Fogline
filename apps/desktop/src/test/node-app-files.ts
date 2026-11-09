import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AppFiles } from '../adapters/app-files';

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** `AppFiles` on the real disk, for running the desktop adapters under Node. */
export class NodeAppFiles implements AppFiles {
  /** Every path written, for asserting atomic writes. */
  readonly writes: string[] = [];

  async readText(path: string): Promise<string | undefined> {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if (isMissing(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async writeText(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, content);
    await rename(temporary, path);
    this.writes.push(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if (isMissing(error)) {
        return false;
      }
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}
