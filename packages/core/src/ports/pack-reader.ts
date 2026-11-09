import type { ValidationIssue } from '@fogline/pack-format';
import type { Pack } from '../domain/pack';

export type ReadPackResult =
  | { readonly ok: true; readonly pack: Pack; readonly warnings: readonly ValidationIssue[] }
  | {
      readonly ok: false;
      readonly errors: readonly ValidationIssue[];
      readonly warnings: readonly ValidationIssue[];
    };

/** Reads packs from wherever they live. Adapters run the pack-format validator. */
export interface PackReader {
  /** Reads and validates the pack folder at `location`. */
  read(location: string): Promise<ReadPackResult>;
  /**
   * The `id` declared by the manifest at `location`, without validating anything else.
   * `undefined` when there is no readable manifest. Used to recognize a pack folder.
   */
  readPackId(location: string): Promise<string | undefined>;
}
