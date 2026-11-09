/**
 * @fogline/pack-format: schemas, validator, migrations and palette helpers for Fogline packs.
 * Pure TypeScript, no I/O: callers supply a `PackSource`.
 */
export * from './schemas/common';
export * from './schemas/palette';
export * from './schemas/manifest';
export * from './schemas/categories';
export * from './schemas/markers';
export * from './schemas/library';
export * from './schemas/progress';
export * from './color/contrast';
export * from './color/palette';
export * from './validate/issues';
export * from './validate/pack-source';
export * from './validate/geometry';
export * from './validate/validate-pack';
export * from './migrations';
export * from './json-schema';

/** Kept for the Stage 1 smoke test; equals `CURRENT_FORMAT_VERSION`. */
export { CURRENT_FORMAT_VERSION as PACK_FORMAT_VERSION } from './schemas/manifest';
