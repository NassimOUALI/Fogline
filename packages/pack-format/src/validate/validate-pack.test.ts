import { describe, expect, it } from 'vitest';
import { BROKEN_FIXTURES, type BrokenFixture } from '../../test/broken-fixtures';
import { loadExamplePack, loadFixture } from '../../test/fixtures';
import { ISSUE_CODES } from './issues';
import { createMemoryPackSource } from './pack-source';
import { validatePack } from './validate-pack';

const validFiles = loadFixture('valid-pack');

function brokenFixture(name: string): BrokenFixture {
  const fixture = BROKEN_FIXTURES.find((f) => f.name === name);
  if (fixture === undefined) {
    throw new Error(`No broken fixture named ${name}`);
  }
  return fixture;
}

describe('validatePack: valid fixture', () => {
  it('reports no issues at all with file checks on', async () => {
    const result = await validatePack(createMemoryPackSource(validFiles));
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('returns the parsed pack', async () => {
    const result = await validatePack(createMemoryPackSource(validFiles));
    expect(result.pack?.manifest.id).toBe('dev.fogline.fixture');
    expect(result.pack?.categories).toHaveLength(2);
    expect(result.pack?.markers.main).toHaveLength(3);
    expect(result.pack?.manifest.maps[0]?.tileSize).toBe(256);
  });
});

describe('validatePack: examples/pack', () => {
  const example = loadExamplePack();

  it('has zero errors without file checks (assumption A2)', async () => {
    const result = await validatePack(createMemoryPackSource(example), { files: 'skip' });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.pack?.manifest.maps).toHaveLength(2);
    expect(Object.keys(result.pack?.markers ?? {})).toEqual(['overworld', 'caves']);
  });

  it('reports exactly the missing imagery with file checks on', async () => {
    const result = await validatePack(createMemoryPackSource(example));
    expect(result.warnings).toEqual([]);
    const byCode = new Map<string, string[]>();
    for (const issue of result.errors) {
      byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue.path]);
    }
    expect([...byCode.keys()].sort()).toEqual([ISSUE_CODES.fileMissing, ISSUE_CODES.tilesMissing]);
    // two icons, one thumbnail, one pmtiles archive
    expect(byCode.get(ISSUE_CODES.fileMissing)).toEqual([
      'categories[0].icon',
      'categories[2].icon',
      'manifest.maps[0].thumbnail',
      'manifest.maps[1].tiles.path',
    ]);
    // overworld zooms 0..4
    expect(byCode.get(ISSUE_CODES.tilesMissing)).toHaveLength(5);
  });
});

describe('validatePack: broken fixtures report exactly one defect', () => {
  for (const fixture of BROKEN_FIXTURES) {
    it(`${fixture.name} -> ${fixture.code} (${fixture.severity})`, async () => {
      const files = fixture.build(validFiles);
      const result = await validatePack(createMemoryPackSource(files), {
        files: fixture.files ?? 'check',
      });
      const codes = [...new Set(result.issues.map((issue) => issue.code))];
      expect(codes).toEqual([fixture.code]);
      expect(result.issues.every((issue) => issue.severity === fixture.severity)).toBe(true);
      expect(result.ok).toBe(fixture.severity === 'warning');
      for (const issue of result.issues) {
        expect(issue.path.length).toBeGreaterThan(0);
        expect(issue.message.length).toBeGreaterThan(10);
      }
    });
  }

  it('missing-license points at the license field', async () => {
    const fixture = brokenFixture('missing-license');
    const result = await validatePack(createMemoryPackSource(fixture.build(validFiles)));
    expect(result.errors.map((issue) => issue.path)).toEqual(['manifest.license']);
  });

  it('unsupported-format-version explains what to do', async () => {
    const fixture = brokenFixture('unsupported-format-version');
    const result = await validatePack(createMemoryPackSource(fixture.build(validFiles)));
    expect(result.errors[0]?.message).toContain('format version 99');
    expect(result.errors[0]?.message).toContain('Update Fogline');
    expect(result.pack).toBeUndefined();
  });

  it('does not run file checks in skip mode', async () => {
    const fixture = brokenFixture('tiles-missing');
    const result = await validatePack(createMemoryPackSource(fixture.build(validFiles)), {
      files: 'skip',
    });
    expect(result.issues).toEqual([]);
  });
});

describe('validatePack: tile sampling', () => {
  it('accepts a custom tile extension', async () => {
    const files = Object.fromEntries(
      Object.entries(validFiles).map(([path, content]) => [
        path.endsWith('.webp') && path.includes('/tiles/') ? path.replace(/\.webp$/, '.png') : path,
        content,
      ]),
    );
    const webp = await validatePack(createMemoryPackSource(files));
    expect(webp.errors.map((issue) => issue.code)).toEqual([
      ISSUE_CODES.tilesMissing,
      ISSUE_CODES.tilesMissing,
    ]);
    const png = await validatePack(createMemoryPackSource(files), { tileExtension: 'png' });
    expect(png.issues).toEqual([]);
  });
});
