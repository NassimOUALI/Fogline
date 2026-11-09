import type { ProgressExport } from '@fogline/core';
import { progressExportSchema } from '@fogline/pack-format';

export type ParsedProgressFile =
  | { readonly ok: true; readonly data: ProgressExport }
  | { readonly ok: false; readonly message: string };

/** Parses an exported progress file with the published schema (assumption A17). */
export function parseProgressExport(text: string): ParsedProgressFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message: 'This file is not valid JSON, so it cannot be a Fogline progress export.',
    };
  }
  const parsed = progressExportSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where =
      first === undefined ? '' : ` (${first.path.join('.') || 'file'}: ${first.message})`;
    return { ok: false, message: `This is not a Fogline progress export${where}.` };
  }
  return { ok: true, data: parsed.data };
}
