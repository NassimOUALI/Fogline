import { createPack, type PackReader, type ReadPackResult } from '@fogline/core';
import { MANIFEST_FILE, validatePack, type PackSource } from '@fogline/pack-format';
import { joinPath, type AppFiles } from './app-files';

/** Reads and validates packs through `AppFiles` with the shared pack-format validator. */
export class FilesPackReader implements PackReader {
  constructor(private readonly files: Pick<AppFiles, 'readText' | 'exists'>) {}

  async read(location: string): Promise<ReadPackResult> {
    const source: PackSource = {
      readText: (path) => this.files.readText(joinPath(location, path)),
      exists: (path) => this.files.exists(joinPath(location, path)),
    };
    try {
      const result = await validatePack(source);
      if (!result.ok || result.pack === undefined) {
        return { ok: false, errors: result.errors, warnings: result.warnings };
      }
      return { ok: true, pack: createPack(result.pack), warnings: result.warnings };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        errors: [
          {
            severity: 'error',
            path: 'manifest',
            code: 'file.missing',
            message: `Fogline cannot read the folder ${location}: ${detail}`,
          },
        ],
        warnings: [],
      };
    }
  }

  async readPackId(location: string): Promise<string | undefined> {
    try {
      const text = await this.files.readText(joinPath(location, MANIFEST_FILE));
      if (text === undefined) {
        return undefined;
      }
      const data = JSON.parse(text) as { id?: unknown };
      return typeof data.id === 'string' ? data.id : undefined;
    } catch {
      return undefined;
    }
  }
}
