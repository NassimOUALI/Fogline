/**
 * Writes the JSON Schema files to packages/pack-format/schemas/.
 * Run with `pnpm --filter @fogline/pack-format schemas`. A test fails when the committed files
 * are out of date.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildJsonSchemas } from '../src/json-schema';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'schemas');
mkdirSync(outDir, { recursive: true });

for (const [name, schema] of Object.entries(buildJsonSchemas())) {
  const file = join(outDir, `${name}.schema.json`);
  writeFileSync(file, `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`wrote ${file}`);
}
