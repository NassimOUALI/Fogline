import { z } from 'zod';
import {
  idSchema,
  languageTagSchema,
  localizedTextSchema,
  relativePathSchema,
  semverSchema,
  sizeSchema,
} from './common';
import { paletteSchema } from './palette';

export const CURRENT_FORMAT_VERSION = 1;
export const DEFAULT_TILE_SIZE = 256;

export const TILE_SOURCE_TYPES = ['xyz', 'pmtiles'] as const;
export type TileSourceType = (typeof TILE_SOURCE_TYPES)[number];

export const tilesSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('xyz'),
      path: relativePathSchema.describe('Folder holding {z}/{x}/{y}.webp tiles'),
    }),
    z.object({
      type: z.literal('pmtiles'),
      path: relativePathSchema.describe('Path to a .pmtiles archive'),
    }),
  ])
  .describe('Where the tiles of a map live');
export type Tiles = z.infer<typeof tilesSchema>;

export const mapEntrySchema = z
  .object({
    id: idSchema,
    name: localizedTextSchema,
    order: z.number().int().describe('Sort order in the map switcher'),
    size: sizeSchema.describe('Source image size at full resolution'),
    tileSize: z.number().int().positive().default(DEFAULT_TILE_SIZE),
    minZoom: z.number().int().min(0),
    maxZoom: z.number().int().min(0).describe('Native zoom: the image at full resolution'),
    tiles: tilesSchema,
    thumbnail: relativePathSchema.optional(),
    calibration: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Reserved: affine transform from pixels to in-game coordinates'),
  })
  .refine((map) => map.minZoom <= map.maxZoom, {
    path: ['maxZoom'],
    message: 'maxZoom must be greater than or equal to minZoom',
  })
  .describe('One map of the pack');
export type MapEntry = z.infer<typeof mapEntrySchema>;

export const authorSchema = z.object({ name: z.string().min(1), url: z.url().optional() });
export type Author = z.infer<typeof authorSchema>;

export const licenseSchema = z
  .object({
    spdx: z.string().min(1).describe('SPDX identifier or "LicenseRef-Custom"'),
    notes: z.string().optional(),
  })
  .describe('Rights status of the pack content');
export type License = z.infer<typeof licenseSchema>;

export const manifestSchema = z
  .object({
    formatVersion: z.literal(CURRENT_FORMAT_VERSION),
    id: idSchema.describe('Stable pack id. Progress is keyed by it.'),
    game: z.object({ name: z.string().min(1), publisher: z.string().optional() }),
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    version: semverSchema.describe('Version of the pack content'),
    authors: z.array(authorSchema).min(1),
    license: licenseSchema,
    attribution: z.array(z.string()).optional(),
    defaultLanguage: languageTagSchema,
    theme: z.object({ palette: paletteSchema.optional() }).optional(),
    maps: z.array(mapEntrySchema).min(1),
    categories: relativePathSchema.describe('Path to the category tree file'),
    markers: z
      .record(idSchema, relativePathSchema)
      .describe('Map id to path of that map’s marker file'),
  })
  .describe('Fogline pack manifest');
export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestInput = z.input<typeof manifestSchema>;
