import { z } from 'zod';
import { idSchema, positionSchema, semverSchema, timestampSchema } from './common';

export const PROGRESS_FORMAT_VERSION = 1;

export const customMarkerSchema = z
  .object({
    id: idSchema,
    map: idSchema,
    position: positionSchema,
    name: z.string().min(1),
    note: z.string().optional(),
    createdAt: timestampSchema,
  })
  .describe('A personal pin added by the user');
export type CustomMarker = z.infer<typeof customMarkerSchema>;

export const filterStateSchema = z
  .object({
    hiddenNodeIds: z.array(z.string()).default([]).describe('Hidden leaf category ids'),
    hideCollected: z.boolean().default(false),
  })
  .describe('Filter state of the category tree');
export type FilterState = z.infer<typeof filterStateSchema>;

export const lastViewSchema = z
  .object({ map: idSchema, center: positionSchema, zoom: z.number() })
  .describe('Viewport to restore on reopen');
export type LastView = z.infer<typeof lastViewSchema>;

/** `markerId -> collectedAt` */
export const collectedSchema = z.record(z.string(), timestampSchema);
export type Collected = z.infer<typeof collectedSchema>;

export const progressFileSchema = z
  .object({
    formatVersion: z.literal(PROGRESS_FORMAT_VERSION),
    packId: idSchema,
    packVersionSeen: semverSchema.optional(),
    updatedAt: timestampSchema,
    collected: collectedSchema.default({}),
    customMarkers: z.array(customMarkerSchema).default([]),
    filters: filterStateSchema.default({ hiddenNodeIds: [], hideCollected: false }),
    lastView: lastViewSchema.optional(),
  })
  .describe('Fogline per-pack progress (progress/<packId>.json)');
export type ProgressFile = z.infer<typeof progressFileSchema>;

export const progressExportSchema = z
  .object({
    formatVersion: z.literal(PROGRESS_FORMAT_VERSION),
    packId: idSchema,
    packVersion: semverSchema,
    exportedAt: timestampSchema,
    collected: collectedSchema.default({}),
    customMarkers: z.array(customMarkerSchema).default([]),
    filters: filterStateSchema.default({ hiddenNodeIds: [], hideCollected: false }),
  })
  .describe('Fogline progress export file');
export type ProgressExport = z.infer<typeof progressExportSchema>;
