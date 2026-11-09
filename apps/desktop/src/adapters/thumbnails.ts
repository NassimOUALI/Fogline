import type { LibraryEntry } from '@fogline/core';
import { MANIFEST_FILE } from '@fogline/pack-format';
import { joinPath, type AppFiles } from './app-files';

/** Copies a pack's preview image into the app data folder for library cards. */
export interface ThumbnailCache {
  /** Returns the cached path relative to the app data folder, or `undefined` if none. */
  cacheFor(entry: LibraryEntry): Promise<string | undefined>;
}

/** The thumbnail of the first map (by `order`) that declares one, from raw manifest text. */
export function thumbnailSourceFor(manifestText: string): string | undefined {
  try {
    const manifest = JSON.parse(manifestText) as {
      maps?: { order?: unknown; thumbnail?: unknown }[];
    };
    const maps = Array.isArray(manifest.maps) ? [...manifest.maps] : [];
    maps.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
    const withThumbnail = maps.find((map) => typeof map.thumbnail === 'string');
    return typeof withThumbnail?.thumbnail === 'string' ? withThumbnail.thumbnail : undefined;
  } catch {
    return undefined;
  }
}

/** Finds the thumbnail through `AppFiles` and copies it with a platform function. */
export class PackThumbnailCache implements ThumbnailCache {
  constructor(
    private readonly files: Pick<AppFiles, 'readText'>,
    private readonly copy: (source: string, packId: string) => Promise<string | undefined>,
  ) {}

  async cacheFor(entry: LibraryEntry): Promise<string | undefined> {
    const manifest = await this.files.readText(joinPath(entry.path, MANIFEST_FILE));
    const relative = manifest === undefined ? undefined : thumbnailSourceFor(manifest);
    if (relative === undefined) {
      return undefined;
    }
    try {
      return await this.copy(joinPath(entry.path, relative), entry.packId);
    } catch {
      return undefined; // a missing preview never blocks an import
    }
  }
}
