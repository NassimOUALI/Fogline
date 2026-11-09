import type { ValidationIssue } from '@fogline/pack-format';
import {
  createLibraryEntry,
  refreshEntryFromPack,
  type LibraryEntry,
  type PackSourceKind,
} from '../../domain/library';
import { packTitle } from '../../domain/pack';
import { nowIso, type Clock } from '../../ports/clock';
import type { AccessGrants, PackStorage, Trash } from '../../ports/file-system';
import type { LibraryRepository } from '../../ports/library-repository';
import type { PackReader } from '../../ports/pack-reader';

export interface ImportPackInput {
  readonly location: string;
  readonly kind: 'folder' | 'archive';
  /** Folders only: copy into the library folder instead of referencing in place. */
  readonly copyIntoLibrary?: boolean | undefined;
  /**
   * What to do when a pack with the same id is already in the library.
   * `ask` (default) stops and returns `needsConfirmation`; `update` replaces it, keeping progress.
   */
  readonly ifExists?: 'ask' | 'update' | undefined;
}

export type ImportPackOutcome =
  | {
      readonly status: 'imported' | 'updated';
      readonly entry: LibraryEntry;
      readonly warnings: readonly ValidationIssue[];
    }
  | {
      readonly status: 'needsConfirmation';
      readonly existing: LibraryEntry;
      readonly incoming: { readonly version: string; readonly title: string };
      readonly warnings: readonly ValidationIssue[];
    }
  | {
      readonly status: 'invalid';
      readonly errors: readonly ValidationIssue[];
      readonly warnings: readonly ValidationIssue[];
    };

export interface ImportPackDeps {
  readonly reader: Pick<PackReader, 'read'>;
  readonly library: LibraryRepository;
  readonly storage: PackStorage;
  readonly files: AccessGrants & Trash;
  readonly clock: Clock;
}

/**
 * Validates and adds a pack. Errors block the import; warnings are returned for display.
 * Folders are referenced in place unless copied; archives are always extracted (copied).
 * Updating an existing pack keeps its progress untouched: progress is keyed by pack id.
 */
export class ImportPack {
  constructor(private readonly deps: ImportPackDeps) {}

  async execute(input: ImportPackInput): Promise<ImportPackOutcome> {
    const { reader, library, storage, files, clock } = this.deps;
    let folder = input.location;
    let source: PackSourceKind = 'referenced';
    let staged = false;
    if (input.kind === 'archive') {
      folder = await storage.extractArchive(input.location);
      source = 'copied';
      staged = true;
    }

    const read = await reader.read(folder);
    if (!read.ok) {
      if (staged) {
        await storage.discard(folder);
      }
      return { status: 'invalid', errors: read.errors, warnings: read.warnings };
    }
    const { pack, warnings } = read;

    const existing = await library.get(pack.id);
    if (existing !== undefined && input.ifExists !== 'update') {
      if (staged) {
        await storage.discard(folder);
      }
      return {
        status: 'needsConfirmation',
        existing,
        incoming: { version: pack.version, title: packTitle(pack) },
        warnings,
      };
    }

    if (input.kind === 'folder' && input.copyIntoLibrary === true) {
      folder = await storage.copyIntoLibrary(folder, pack.id);
      source = 'copied';
    }
    if (source === 'referenced') {
      await files.grantAccess(folder);
    }

    const now = nowIso(clock);
    const location = { path: folder, source };
    const entry =
      existing === undefined
        ? createLibraryEntry(pack, location, now)
        : refreshEntryFromPack(existing, pack, location);
    await library.save(entry);

    // An app-owned copy that the update replaced is no longer referenced by anything.
    if (existing?.source === 'copied' && existing.path !== folder) {
      await files.moveToTrash(existing.path);
    }
    return { status: existing === undefined ? 'imported' : 'updated', entry, warnings };
  }
}
