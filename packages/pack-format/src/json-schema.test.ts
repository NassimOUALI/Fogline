import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildJsonSchemas, PUBLISHED_SCHEMAS, type PublishedSchemaName } from './json-schema';

const schemasDir = fileURLToPath(new URL('../schemas/', import.meta.url));

describe('buildJsonSchemas', () => {
  const schemas = buildJsonSchemas();

  it('produces one draft 2020-12 document per published schema', () => {
    expect(Object.keys(schemas).sort()).toEqual(Object.keys(PUBLISHED_SCHEMAS).sort());
    for (const [name, schema] of Object.entries(schemas)) {
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(schema.$id).toBe(`https://fogline.dev/schemas/v1/${name}.schema.json`);
    }
  });

  it('pins formatVersion in the manifest schema', () => {
    const manifest = schemas.manifest as { properties: { formatVersion: { const?: number } } };
    expect(manifest.properties.formatVersion.const).toBe(1);
  });

  it('describes the recursive category tree with a $ref', () => {
    const text = JSON.stringify(schemas.categories);
    expect(text).toContain('"$ref"');
    expect(text).toContain('"children"');
  });

  it('matches the committed files in schemas/ (run `pnpm --filter @fogline/pack-format schemas`)', () => {
    for (const name of Object.keys(schemas) as PublishedSchemaName[]) {
      const committed = JSON.parse(
        readFileSync(join(schemasDir, `${name}.schema.json`), 'utf8'),
      ) as unknown;
      expect(committed, `${name}.schema.json is stale`).toEqual(schemas[name]);
    }
  });
});
