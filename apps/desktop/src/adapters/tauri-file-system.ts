import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { FileFilter, FileSystem } from '@fogline/core';
import type { AppFiles } from './app-files';

function dialogFilters(filters: readonly FileFilter[]): { name: string; extensions: string[] }[] {
  return filters.map((filter) => ({ name: filter.name, extensions: [...filter.extensions] }));
}

/**
 * The core `FileSystem` port in the desktop app. Anything the webview cannot do safely on its
 * own goes to a Rust command in `src-tauri/src/commands.rs`.
 */
export class TauriFileSystem implements FileSystem {
  constructor(private readonly files: AppFiles) {}

  exists(path: string): Promise<boolean> {
    return invoke<boolean>('path_exists', { path });
  }

  moveToTrash(path: string): Promise<void> {
    return invoke('move_to_trash', { path });
  }

  grantAccess(path: string): Promise<void> {
    return invoke('grant_access', { path });
  }

  copyIntoLibrary(folder: string, packId: string): Promise<string> {
    return invoke<string>('copy_into_library', { folder, packId });
  }

  extractArchive(archive: string): Promise<string> {
    return invoke<string>('extract_archive', { archive });
  }

  discard(folder: string): Promise<void> {
    return invoke('discard_library_folder', { path: folder });
  }

  async pickFolder(): Promise<string | undefined> {
    const picked = await open({ directory: true, multiple: false });
    return typeof picked === 'string' ? picked : undefined;
  }

  async pickFile(filters: readonly FileFilter[]): Promise<string | undefined> {
    const picked = await open({
      directory: false,
      multiple: false,
      filters: dialogFilters(filters),
    });
    return typeof picked === 'string' ? picked : undefined;
  }

  async pickSaveLocation(
    defaultName: string,
    filters: readonly FileFilter[],
  ): Promise<string | undefined> {
    const picked = await save({ defaultPath: defaultName, filters: dialogFilters(filters) });
    return picked ?? undefined;
  }

  async readText(path: string): Promise<string> {
    const text = await this.files.readText(path);
    if (text === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return text;
  }

  writeText(path: string, content: string): Promise<void> {
    return this.files.writeText(path, content);
  }
}

/** Copies a thumbnail into `<app data>/thumbnails` through the Rust command. */
export function cacheThumbnailWithTauri(
  source: string,
  packId: string,
): Promise<string | undefined> {
  return invoke<string | null>('cache_thumbnail', { source, packId }).then(
    (path) => path ?? undefined,
  );
}
