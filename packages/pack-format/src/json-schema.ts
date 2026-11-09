import { z } from 'zod';
import { categoriesFileSchema } from './schemas/categories';
import { libraryFileSchema } from './schemas/library';
import { manifestSchema } from './schemas/manifest';
import { markersFileSchema } from './schemas/markers';
import { progressExportSchema, progressFileSchema } from './schemas/progress';

export const JSON_SCHEMA_BASE_URL = 'https://fogline.dev/schemas/v1/';

/** Every file format Fogline reads or writes, by schema file name (without extension). */
export const PUBLISHED_SCHEMAS = {
  manifest: manifestSchema,
  categories: categoriesFileSchema,
  markers: markersFileSchema,
  library: libraryFileSchema,
  progress: progressFileSchema,
  'progress-export': progressExportSchema,
} as const;

export type PublishedSchemaName = keyof typeof PUBLISHED_SCHEMAS;

export type JsonSchema = Record<string, unknown>;

/** Builds JSON Schema (draft 2020-12) documents for community tooling. */
export function buildJsonSchemas(): Record<PublishedSchemaName, JsonSchema> {
  const out = {} as Record<PublishedSchemaName, JsonSchema>;
  for (const name of Object.keys(PUBLISHED_SCHEMAS) as PublishedSchemaName[]) {
    const schema = z.toJSONSchema(PUBLISHED_SCHEMAS[name], {
      target: 'draft-2020-12',
      io: 'input',
      unrepresentable: 'any',
    });
    out[name] = {
      $id: `${JSON_SCHEMA_BASE_URL}${name}.schema.json`,
      title: `Fogline ${name}`,
      ...schema,
    };
  }
  return out;
}
