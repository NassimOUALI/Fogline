import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Tauri bridge is mocked: these tests check that each port method calls the right command
// with the right arguments. The commands themselves are Rust (src-tauri/src/commands.rs).
const invoke = vi.fn<(command: string, args?: unknown) => Promise<unknown>>();
const open = vi.fn<(options: unknown) => Promise<unknown>>();
const save = vi.fn<(options: unknown) => Promise<unknown>>();
const fsCalls: string[] = [];
const existing = new Set<string>();

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open, save }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (path: string) => Promise.resolve(existing.has(path)),
  readTextFile: (path: string) => {
    fsCalls.push(`read ${path}`);
    return Promise.resolve('content');
  },
  writeTextFile: (path: string) => {
    fsCalls.push(`write ${path}`);
    return Promise.resolve();
  },
  mkdir: (path: string) => {
    fsCalls.push(`mkdir ${path}`);
    return Promise.resolve();
  },
  rename: (from: string, to: string) => {
    fsCalls.push(`rename ${from} -> ${to}`);
    return Promise.resolve();
  },
  remove: (path: string) => {
    fsCalls.push(`remove ${path}`);
    return Promise.resolve();
  },
}));

const { TauriFileSystem, cacheThumbnailWithTauri } = await import('./tauri-file-system');
const { TauriAppFiles } = await import('./tauri-app-files');

beforeEach(() => {
  invoke.mockReset().mockResolvedValue(undefined);
  open.mockReset();
  save.mockReset();
  fsCalls.length = 0;
  existing.clear();
});

describe('TauriFileSystem', () => {
  const files = new TauriFileSystem(new TauriAppFiles());

  it('maps port methods to Rust commands', async () => {
    invoke.mockResolvedValueOnce(true);
    expect(await files.exists('D:/p')).toBe(true);
    await files.moveToTrash('D:/p');
    await files.grantAccess('D:/p');
    invoke.mockResolvedValueOnce('/lib/x');
    expect(await files.copyIntoLibrary('D:/p', 'com.x')).toBe('/lib/x');
    invoke.mockResolvedValueOnce('/lib/extracted-1');
    expect(await files.extractArchive('D:/a.fogpack')).toBe('/lib/extracted-1');
    await files.discard('/lib/extracted-1');
    expect(invoke.mock.calls).toEqual([
      ['path_exists', { path: 'D:/p' }],
      ['move_to_trash', { path: 'D:/p' }],
      ['grant_access', { path: 'D:/p' }],
      ['copy_into_library', { folder: 'D:/p', packId: 'com.x' }],
      ['extract_archive', { archive: 'D:/a.fogpack' }],
      ['discard_library_folder', { path: '/lib/extracted-1' }],
    ]);
  });

  it('uses native dialogs and treats cancel as undefined', async () => {
    open
      .mockResolvedValueOnce('D:/picked')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('D:/a.fogpack');
    expect(await files.pickFolder()).toBe('D:/picked');
    expect(await files.pickFolder()).toBeUndefined();
    expect(await files.pickFile([{ name: 'Pack', extensions: ['fogpack'] }])).toBe('D:/a.fogpack');
    expect(open.mock.calls[2]?.[0]).toEqual({
      directory: false,
      multiple: false,
      filters: [{ name: 'Pack', extensions: ['fogpack'] }],
    });
    save.mockResolvedValueOnce('D:/out.json').mockResolvedValueOnce(null);
    expect(await files.pickSaveLocation('x.json', [])).toBe('D:/out.json');
    expect(await files.pickSaveLocation('x.json', [])).toBeUndefined();
  });

  it('reads and writes text through the file plugin', async () => {
    existing.add('D:/in.json');
    expect(await files.readText('D:/in.json')).toBe('content');
    await expect(files.readText('D:/missing.json')).rejects.toThrow('File not found');
    await files.writeText('D:/out/x.json', '{}');
    expect(fsCalls).toEqual([
      'read D:/in.json',
      'mkdir D:/out',
      'write D:/out/x.json.tmp',
      'rename D:/out/x.json.tmp -> D:/out/x.json',
    ]);
  });

  it('caches thumbnails through the Rust command', async () => {
    invoke.mockResolvedValueOnce('thumbnails/a.webp').mockResolvedValueOnce(null);
    expect(await cacheThumbnailWithTauri('D:/p/t.webp', 'a')).toBe('thumbnails/a.webp');
    expect(await cacheThumbnailWithTauri('D:/p/none.webp', 'a')).toBeUndefined();
    expect(invoke.mock.calls[0]).toEqual([
      'cache_thumbnail',
      { source: 'D:/p/t.webp', packId: 'a' },
    ]);
  });
});

describe('TauriAppFiles', () => {
  it('returns undefined for missing files and removes only existing ones', async () => {
    const files = new TauriAppFiles();
    expect(await files.readText('D:/nope')).toBeUndefined();
    expect(await files.exists('D:/nope')).toBe(false);
    await files.remove('D:/nope');
    existing.add('D:/yes');
    await files.remove('D:/yes');
    expect(fsCalls).toEqual(['remove D:/yes']);
  });
});
