import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { joinPath } from '../adapters/app-files';
import { FilesPackReader } from '../adapters/files-pack-reader';
import { JsonLibraryRepository, JsonProgressStore } from '../adapters/json-stores';
import { randomIdGenerator, systemClock } from '../adapters/system';
import { TauriAppFiles } from '../adapters/tauri-app-files';
import { cacheThumbnailWithTauri, TauriFileSystem } from '../adapters/tauri-file-system';
import { PackThumbnailCache } from '../adapters/thumbnails';
import { createServices, regrantLibraryAccess, type AppServices } from './services';

/** True inside the Tauri webview; false in a plain browser or under tests. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Composition root of the desktop app: real adapters, then launch-time housekeeping. */
export async function createTauriServices(): Promise<AppServices> {
  const dataDir = await appDataDir();
  const appFiles = new TauriAppFiles();
  const onCorruptFile = (path: string, backup: string): void => {
    console.warn(`Fogline could not read ${path}; it was kept as ${backup}.`);
  };
  const services = createServices({
    library: new JsonLibraryRepository(appFiles, dataDir, { onCorruptFile }),
    progress: new JsonProgressStore(appFiles, dataDir, { onCorruptFile }),
    reader: new FilesPackReader(appFiles),
    files: new TauriFileSystem(appFiles),
    clock: systemClock,
    ids: randomIdGenerator,
    thumbnails: new PackThumbnailCache(appFiles, cacheThumbnailWithTauri),
    appDataUrl: (relativePath) => convertFileSrc(joinPath(dataDir, relativePath)),
  });
  await regrantLibraryAccess(services.ports);
  return services;
}
