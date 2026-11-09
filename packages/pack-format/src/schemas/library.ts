import { z } from 'zod';
import { idSchema, semverSchema, timestampSchema } from './common';

export const LIBRARY_FORMAT_VERSION = 1;

export const libraryEntrySchema = z
  .object({
    packId: idSchema,
    title: z.string().min(1).describe('Resolved title in the pack default language'),
    gameName: z.string().min(1),
    version: semverSchema,
    path: z.string().min(1).describe('Absolute path of the pack folder'),
    source: z.enum(['referenced', 'copied']),
    importedAt: timestampSchema,
    lastOpenedAt: timestampSchema.optional(),
    thumbnail: z.string().optional().describe('Cached thumbnail, relative to the app data folder'),
    markerCount: z.number().int().min(0),
    status: z.enum(['available', 'missing']).describe('Cached; recomputed on launch'),
  })
  .describe('One known pack');
export type LibraryEntry = z.infer<typeof libraryEntrySchema>;

export const libraryFileSchema = z
  .object({
    formatVersion: z.literal(LIBRARY_FORMAT_VERSION),
    entries: z.array(libraryEntrySchema),
  })
  .describe('Fogline library registry (library.json)');
export type LibraryFile = z.infer<typeof libraryFileSchema>;
