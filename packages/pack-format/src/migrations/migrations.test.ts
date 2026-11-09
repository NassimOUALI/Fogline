import { describe, expect, it } from 'vitest';
import { CURRENT_FORMAT_VERSION } from '../schemas/manifest';
import { migrateManifest, MIGRATIONS, type Migration } from './index';

describe('migrateManifest', () => {
  it('passes a current manifest through unchanged', () => {
    const raw = { formatVersion: CURRENT_FORMAT_VERSION, id: 'x' };
    const result = migrateManifest(raw);
    expect(result).toEqual({ ok: true, manifest: raw, fromVersion: CURRENT_FORMAT_VERSION });
  });

  it('refuses a newer format version with a clear message', () => {
    const result = migrateManifest({ formatVersion: CURRENT_FORMAT_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('format.unsupportedVersion');
      expect(result.message).toContain(`format version ${String(CURRENT_FORMAT_VERSION + 1)}`);
      expect(result.message).toContain(`up to ${String(CURRENT_FORMAT_VERSION)}`);
      expect(result.message).toContain('Update Fogline');
    }
  });

  it('refuses missing or malformed versions', () => {
    for (const raw of [
      {},
      { formatVersion: '1' },
      { formatVersion: 0 },
      { formatVersion: 1.5 },
      null,
    ]) {
      const result = migrateManifest(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('format.invalidVersion');
      }
    }
  });

  it('applies a chain of migrations to reach the current version', () => {
    const fake: Migration[] = [
      { from: 1, to: 2, migrate: (raw) => ({ ...raw, formatVersion: 2, a: true }) },
      { from: 2, to: 3, migrate: (raw) => ({ ...raw, formatVersion: 3, b: true }) },
    ];
    const result = migrateManifest({ formatVersion: 1 }, fake, 3);
    expect(result).toEqual({
      ok: true,
      manifest: { formatVersion: 3, a: true, b: true },
      fromVersion: 1,
    });
  });

  it('reports a gap in the migration chain', () => {
    const fake: Migration[] = [{ from: 2, to: 3, migrate: (raw) => raw }];
    const result = migrateManifest({ formatVersion: 1 }, fake, 3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('format.unsupportedVersion');
      expect(result.message).toContain('No migration path');
    }
  });

  it('has no registered migrations yet for format version 1', () => {
    expect(MIGRATIONS).toEqual([]);
  });
});
