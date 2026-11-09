import { withPath, withStatus, type LibraryEntry } from '../../domain/library';
import { fail, ok, type Result } from '../../domain/result';
import type { AccessGrants } from '../../ports/file-system';
import type { LibraryRepository } from '../../ports/library-repository';
import type { PackReader } from '../../ports/pack-reader';
import { notInLibrary } from '../shared';

export interface RelinkPackDeps {
  readonly library: LibraryRepository;
  readonly reader: Pick<PackReader, 'readPackId'>;
  readonly files: AccessGrants;
}

/**
 * Locate: points a library entry at a new folder after checking that the folder holds the
 * same pack id. Progress is untouched.
 */
export class RelinkPack {
  constructor(private readonly deps: RelinkPackDeps) {}

  async execute(input: {
    readonly packId: string;
    readonly location: string;
  }): Promise<Result<LibraryEntry>> {
    const { library, reader, files } = this.deps;
    const entry = await library.get(input.packId);
    if (entry === undefined) {
      return fail('library.notFound', notInLibrary(input.packId));
    }
    const foundId = await reader.readPackId(input.location);
    if (foundId === undefined) {
      return fail('pack.notFound', `No Fogline pack manifest was found in ${input.location}.`);
    }
    if (foundId !== input.packId) {
      return fail(
        'pack.idMismatch',
        `That folder contains pack "${foundId}", not "${input.packId}". Choose the folder of "${entry.title}".`,
      );
    }
    await files.grantAccess(input.location);
    const relinked = withStatus(withPath(entry, input.location), 'available');
    await library.save(relinked);
    return ok(relinked);
  }
}
