import {
  BuildCategoryTree,
  DeletePackFiles,
  ExportProgress,
  ImportPack,
  ImportProgress,
  ListLibrary,
  OpenPack,
  RelinkPack,
  RemoveFromLibrary,
  ResetProgress,
  type Clock,
  type FileSystem,
  type IdGenerator,
  type LibraryRepository,
  type PackReader,
  type ProgressStore,
} from '@fogline/core';
import type { ThumbnailCache } from '../adapters/thumbnails';

/** Every port the desktop app needs, from whichever adapters the platform provides. */
export interface DesktopPorts {
  readonly library: LibraryRepository;
  readonly progress: ProgressStore;
  readonly reader: PackReader;
  readonly files: FileSystem;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly thumbnails: ThumbnailCache;
  /** URL the webview can load for a file under the app data folder. */
  readonly appDataUrl: (relativePath: string) => string;
}

/** Use cases wired to ports. The UI only talks to this object. */
export interface AppServices {
  readonly ports: DesktopPorts;
  readonly listLibrary: ListLibrary;
  readonly importPack: ImportPack;
  readonly openPack: OpenPack;
  readonly relinkPack: RelinkPack;
  readonly removeFromLibrary: RemoveFromLibrary;
  readonly deletePackFiles: DeletePackFiles;
  readonly resetProgress: ResetProgress;
  readonly exportProgress: ExportProgress;
  readonly importProgress: ImportProgress;
  readonly buildCategoryTree: BuildCategoryTree;
}

export function createServices(ports: DesktopPorts): AppServices {
  const { library, progress, reader, files, clock } = ports;
  return {
    ports,
    listLibrary: new ListLibrary({ library, files, progress }),
    importPack: new ImportPack({ reader, library, storage: files, files, clock }),
    openPack: new OpenPack({ library, reader, progress, files, clock }),
    relinkPack: new RelinkPack({ library, reader, files }),
    removeFromLibrary: new RemoveFromLibrary({ library, progress }),
    deletePackFiles: new DeletePackFiles({ library, reader, files, progress }),
    resetProgress: new ResetProgress({ progress, clock }),
    exportProgress: new ExportProgress({ progress, clock }),
    importProgress: new ImportProgress({ progress, clock }),
    buildCategoryTree: new BuildCategoryTree(),
  };
}

/**
 * At launch, file access grants from the previous session are gone (Tauri scopes are
 * per-session). Re-grant every registered pack folder that still exists.
 */
export async function regrantLibraryAccess(
  ports: Pick<DesktopPorts, 'library' | 'files'>,
): Promise<number> {
  let granted = 0;
  for (const entry of await ports.library.list()) {
    if (await ports.files.exists(entry.path)) {
      try {
        await ports.files.grantAccess(entry.path);
        granted += 1;
      } catch {
        // The card will show the pack; opening it reports the problem.
      }
    }
  }
  return granted;
}
