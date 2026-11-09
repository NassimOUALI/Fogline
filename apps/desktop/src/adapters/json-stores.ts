import type { LibraryEntry, LibraryRepository, Progress, ProgressStore } from '@fogline/core';
import {
  LIBRARY_FORMAT_VERSION,
  libraryFileSchema,
  PROGRESS_FORMAT_VERSION,
  progressFileSchema,
} from '@fogline/pack-format';
import { joinPath, type AppFiles } from './app-files';

export const LIBRARY_FILE = 'library.json';
export const PROGRESS_FOLDER = 'progress';

export interface JsonStoreOptions {
  /**
   * Called when a stored file cannot be read. The file is kept as `<name>.corrupt-<time>` and
   * the store starts empty for it, so user data is never overwritten silently.
   */
  readonly onCorruptFile?: ((path: string, backupPath: string) => void) | undefined;
}

/** Pack ids may contain `:`, which Windows forbids in file names; encoding is reversible. */
export function progressFileName(packId: string): string {
  return `${encodeURIComponent(packId)}.json`;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function quarantine(
  files: AppFiles,
  path: string,
  text: string,
  options: JsonStoreOptions,
): Promise<void> {
  const backup = `${path}.corrupt-${String(Date.now())}`;
  await files.writeText(backup, text);
  await files.remove(path);
  options.onCorruptFile?.(path, backup);
}

/** Runs tasks one at a time, so concurrent saves cannot lose each other's changes. */
class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

/** `library.json` in the app data folder. */
export class JsonLibraryRepository implements LibraryRepository {
  private readonly queue = new SerialQueue();
  private readonly path: string;

  constructor(
    private readonly files: AppFiles,
    dataDir: string,
    private readonly options: JsonStoreOptions = {},
  ) {
    this.path = joinPath(dataDir, LIBRARY_FILE);
  }

  list(): Promise<readonly LibraryEntry[]> {
    return this.queue.run(() => this.readAll());
  }

  async get(packId: string): Promise<LibraryEntry | undefined> {
    return (await this.list()).find((entry) => entry.packId === packId);
  }

  save(entry: LibraryEntry): Promise<void> {
    return this.queue.run(async () => {
      const entries = (await this.readAll()).filter((other) => other.packId !== entry.packId);
      await this.writeAll([...entries, entry]);
    });
  }

  remove(packId: string): Promise<void> {
    return this.queue.run(async () => {
      const entries = await this.readAll();
      const kept = entries.filter((entry) => entry.packId !== packId);
      if (kept.length !== entries.length) {
        await this.writeAll(kept);
      }
    });
  }

  private async readAll(): Promise<LibraryEntry[]> {
    const text = await this.files.readText(this.path);
    if (text === undefined) {
      return [];
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      await quarantine(this.files, this.path, text, this.options);
      return [];
    }
    const parsed = libraryFileSchema.safeParse(data);
    if (!parsed.success) {
      await quarantine(this.files, this.path, text, this.options);
      return [];
    }
    return parsed.data.entries;
  }

  private async writeAll(entries: readonly LibraryEntry[]): Promise<void> {
    const sorted = [...entries].sort((a, b) => a.packId.localeCompare(b.packId));
    await this.files.writeText(
      this.path,
      serialize({ formatVersion: LIBRARY_FORMAT_VERSION, entries: sorted }),
    );
  }
}

/** `progress/<packId>.json` in the app data folder, one file per pack. */
export class JsonProgressStore implements ProgressStore {
  private readonly queue = new SerialQueue();
  private readonly folder: string;

  constructor(
    private readonly files: AppFiles,
    dataDir: string,
    private readonly options: JsonStoreOptions = {},
  ) {
    this.folder = joinPath(dataDir, PROGRESS_FOLDER);
  }

  load(packId: string): Promise<Progress | undefined> {
    return this.queue.run(async () => {
      const path = this.pathFor(packId);
      const text = await this.files.readText(path);
      if (text === undefined) {
        return undefined;
      }
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        await quarantine(this.files, path, text, this.options);
        return undefined;
      }
      const parsed = progressFileSchema.safeParse(data);
      if (!parsed.success || parsed.data.packId !== packId) {
        await quarantine(this.files, path, text, this.options);
        return undefined;
      }
      const { formatVersion: _formatVersion, ...progress } = parsed.data;
      return progress;
    });
  }

  save(progress: Progress): Promise<void> {
    return this.queue.run(() =>
      this.files.writeText(
        this.pathFor(progress.packId),
        serialize({ formatVersion: PROGRESS_FORMAT_VERSION, ...progress }),
      ),
    );
  }

  delete(packId: string): Promise<void> {
    return this.queue.run(() => this.files.remove(this.pathFor(packId)));
  }

  private pathFor(packId: string): string {
    return joinPath(this.folder, progressFileName(packId));
  }
}
