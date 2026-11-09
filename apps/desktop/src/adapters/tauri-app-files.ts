import { exists, mkdir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import type { AppFiles } from './app-files';

function parentOf(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index <= 0 ? path : path.slice(0, index);
}

/** `AppFiles` over the Tauri file plugin. Access is limited by the capability scope. */
export class TauriAppFiles implements AppFiles {
  async readText(path: string): Promise<string | undefined> {
    if (!(await exists(path))) {
      return undefined;
    }
    return readTextFile(path);
  }

  async writeText(path: string, content: string): Promise<void> {
    await mkdir(parentOf(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeTextFile(temporary, content);
    await rename(temporary, path);
  }

  exists(path: string): Promise<boolean> {
    return exists(path);
  }

  async remove(path: string): Promise<void> {
    if (await exists(path)) {
      await remove(path);
    }
  }
}
