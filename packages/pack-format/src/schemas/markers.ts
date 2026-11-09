import { z } from 'zod';
import { idSchema, localizedTextSchema, positionSchema } from './common';

export const markerAttributeSchema = z
  .object({
    key: z.string().min(1),
    label: localizedTextSchema,
    value: z.union([localizedTextSchema, z.number(), z.boolean()]),
  })
  .describe('Generic key/label/value shown in the detail panel');
export type MarkerAttribute = z.infer<typeof markerAttributeSchema>;

export const markerSchema = z
  .object({
    id: idSchema.describe('Stable across pack versions; progress depends on it'),
    category: idSchema.describe('A leaf category id'),
    position: positionSchema,
    name: localizedTextSchema,
    description: localizedTextSchema.optional(),
    attributes: z.array(markerAttributeSchema).optional(),
    article: idSchema.optional().describe('Article id under data/articles/'),
    tags: z.array(z.string()).optional().describe('Reserved for future facets; ignored in v1'),
  })
  .describe('One marker on a map');
export type Marker = z.infer<typeof markerSchema>;

export const markersFileSchema = z
  .array(markerSchema)
  .describe('Fogline marker list for one map (data/markers/<mapId>.json)');
export type MarkersFile = z.infer<typeof markersFileSchema>;
