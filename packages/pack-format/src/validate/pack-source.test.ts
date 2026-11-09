import { describe, expect, it } from 'vitest';
import {
  createMemoryPackSource,
  isSafeRelativePath,
  joinRelativePath,
  normalizeRelativePath,
} from './pack-source';

describe('isSafeRelativePath', () => {
  it('accepts plain relative paths', () => {
    expect(isSafeRelativePath('data/categories.json')).toBe(true);
    expect(isSafeRelativePath('./maps/overworld/tiles')).toBe(true);
    expect(isSafeRelativePath('maps\\overworld\\tiles')).toBe(true);
  });

  it('rejects escapes, absolute paths and drive letters', () => {
    expect(isSafeRelativePath('../x.json')).toBe(false);
    expect(isSafeRelativePath('data/../../x.json')).toBe(false);
    expect(isSafeRelativePath('/etc/passwd')).toBe(false);
    expect(isSafeRelativePath('C:/packs/x')).toBe(false);
    expect(isSafeRelativePath('')).toBe(false);
    expect(isSafeRelativePath('a//b')).toBe(false);
  });
});

describe('path helpers', () => {
  it('normalizes separators and leading ./', () => {
    expect(normalizeRelativePath('.\\data\\x.json')).toBe('data/x.json');
    expect(normalizeRelativePath('././a')).toBe('a');
  });

  it('joins segments', () => {
    expect(joinRelativePath('maps/', 'main', 'tiles/')).toBe('maps/main/tiles');
    expect(joinRelativePath('', 'a')).toBe('a');
  });
});

describe('createMemoryPackSource', () => {
  const source = createMemoryPackSource({
    'manifest.json': '{}',
    './data/x.bin': new TextEncoder().encode('bytes'),
  });

  it('reads text and decodes bytes', async () => {
    expect(await source.readText('manifest.json')).toBe('{}');
    expect(await source.readText('data/x.bin')).toBe('bytes');
    expect(await source.readText('missing.json')).toBeUndefined();
  });

  it('answers exists with normalized paths', async () => {
    expect(await source.exists('./manifest.json')).toBe(true);
    expect(await source.exists('data\\x.bin')).toBe(true);
    expect(await source.exists('nope')).toBe(false);
  });
});
