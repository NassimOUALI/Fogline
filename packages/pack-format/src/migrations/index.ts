import { CURRENT_FORMAT_VERSION } from '../schemas/manifest';

/** Upgrades a raw manifest from `from` to `to` (`to === from + 1`). */
export interface Migration {
  from: number;
  to: number;
  migrate(raw: Record<string, unknown>): Record<string, unknown>;
}

/** Registered migrations. Add one entry per `formatVersion` bump. */
export const MIGRATIONS: readonly Migration[] = [];

export type MigrationResult =
  | { ok: true; manifest: Record<string, unknown>; fromVersion: number }
  | {
      ok: false;
      code: 'format.unsupportedVersion' | 'format.invalidVersion';
      message: string;
    };

function readFormatVersion(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const value = (raw as Record<string, unknown>).formatVersion;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : undefined;
}

/**
 * Brings a raw manifest object to the current format version, or explains why it cannot.
 * Newer packs are refused with a clear message rather than parsed on a best-effort basis.
 */
export function migrateManifest(
  raw: unknown,
  migrations: readonly Migration[] = MIGRATIONS,
  currentVersion: number = CURRENT_FORMAT_VERSION,
): MigrationResult {
  const version = readFormatVersion(raw);
  if (version === undefined) {
    return {
      ok: false,
      code: 'format.invalidVersion',
      message: 'manifest.formatVersion must be a positive integer.',
    };
  }
  if (version > currentVersion) {
    return {
      ok: false,
      code: 'format.unsupportedVersion',
      message:
        `This pack uses format version ${String(version)}, but this version of Fogline supports ` +
        `up to ${String(currentVersion)}. Update Fogline to open it.`,
    };
  }
  let manifest = raw as Record<string, unknown>;
  let at = version;
  while (at < currentVersion) {
    const step = migrations.find((m) => m.from === at);
    if (step === undefined) {
      return {
        ok: false,
        code: 'format.unsupportedVersion',
        message: `No migration path from format version ${String(at)} to ${String(currentVersion)}.`,
      };
    }
    manifest = step.migrate(manifest);
    at = step.to;
  }
  return { ok: true, manifest, fromVersion: version };
}
