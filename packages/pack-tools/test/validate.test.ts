import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BROKEN_FIXTURES,
  EXAMPLES_DIR,
  FIXTURES_DIR,
  loadFixture,
} from '@fogline/pack-format/testing';
import { cleanTempDirs, makeTempDir, run, writeFileMap } from './helpers';

afterAll(cleanTempDirs);

const validDir = join(FIXTURES_DIR, 'valid-pack');
const exampleDir = join(EXAMPLES_DIR, 'pack');

interface JsonReport {
  ok: boolean;
  pack: { id: string; version: string } | null;
  errors: { code: string; path: string; message: string }[];
  warnings: { code: string }[];
}

describe('fogline-pack validate', () => {
  it('accepts the valid fixture with a clear verdict', async () => {
    const result = await run('validate', validDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Pack: Fixture pack (dev.fogline.fixture) version 1.0.0');
    expect(result.stdout).toContain('Valid: 0 errors, 0 warnings.');
  });

  it('fails examples/pack on its missing imagery unless file checks are skipped', async () => {
    const full = await run('validate', exampleDir, '--json');
    expect(full.code).toBe(1);
    const report = JSON.parse(full.stdout) as JsonReport;
    expect(new Set(report.errors.map((issue) => issue.code))).toEqual(
      new Set(['file.missing', 'tiles.missing']),
    );
    expect((await run('validate', exampleDir, '--skip-files')).code).toBe(0);
  });

  for (const fixture of BROKEN_FIXTURES) {
    it(`reports ${fixture.code} for the ${fixture.name} fixture`, async () => {
      const dir = await makeTempDir();
      await writeFileMap(dir, fixture.build(loadFixture('valid-pack')));
      const args = ['validate', dir, '--json'];
      if (fixture.files === 'skip') {
        args.push('--skip-files');
      }
      const result = await run(...args);
      const report = JSON.parse(result.stdout) as JsonReport;
      const codes = new Set([...report.errors, ...report.warnings].map((issue) => issue.code));
      expect([...codes]).toEqual([fixture.code]);
      expect(result.code).toBe(fixture.severity === 'error' ? 1 : 0);
      expect(report.ok).toBe(fixture.severity === 'warning');
    });
  }

  it('groups errors before warnings in the human report', async () => {
    const dir = await makeTempDir();
    const missingIcon = BROKEN_FIXTURES.find((f) => f.name === 'missing-icon-file');
    const similar = BROKEN_FIXTURES.find((f) => f.name === 'similar-sibling-colors');
    if (missingIcon === undefined || similar === undefined) {
      throw new Error('fixtures missing');
    }
    await writeFileMap(dir, missingIcon.build(similar.build(loadFixture('valid-pack'))));
    const result = await run('validate', dir);
    expect(result.code).toBe(1);
    const errorsAt = result.stdout.indexOf('Errors (1):');
    const warningsAt = result.stdout.indexOf('Warnings (1):');
    expect(errorsAt).toBeGreaterThan(-1);
    expect(warningsAt).toBeGreaterThan(errorsAt);
    expect(result.stdout).toContain('[file.missing] categories[1].icon');
    expect(result.stdout).toContain('File not found: icons/camp.svg');
    expect(result.stdout).toContain('Invalid: 1 error, 1 warning.');
  });

  it('checks png tiles when told the extension', async () => {
    const files = loadFixture('valid-pack');
    const png = Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path.includes('/tiles/') ? path.replace(/\.webp$/, '.png') : path,
        content,
      ]),
    );
    const dir = await makeTempDir();
    await writeFileMap(dir, png);
    expect((await run('validate', dir)).code).toBe(1);
    expect((await run('validate', dir, '--tile-extension', 'png')).code).toBe(0);
  });

  it('explains paths that are missing or not packs', async () => {
    const missing = await run('validate', join(validDir, 'nope'));
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('Path not found');
    const dir = await makeTempDir();
    const file = join(dir, 'notes.txt');
    await writeFile(file, 'hello');
    const notPack = await run('validate', file);
    expect(notPack.code).toBe(1);
    expect(notPack.stderr).toContain('Expected a pack folder or a .fogpack archive');
  });
});
