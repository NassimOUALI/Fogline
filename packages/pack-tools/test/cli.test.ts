import { describe, expect, it } from 'vitest';
import { CLI_VERSION } from '../src/cli';
import { captureIO, CliError, formatBytes } from '../src/io';
import { run } from './helpers';

describe('fogline-pack command line', () => {
  it('prints help to stderr and exits 2 without a command', async () => {
    const result = await run();
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('Usage:');
  });

  it('prints help and the version on request', async () => {
    for (const argv of [['--help'], ['-h'], ['help'], ['validate', '--help']]) {
      const result = await run(...argv);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('fogline-pack validate <path>');
    }
    expect((await run('--version')).stdout).toBe(CLI_VERSION);
  });

  it('rejects unknown commands and options', async () => {
    const unknownCommand = await run('frobnicate');
    expect(unknownCommand.code).toBe(2);
    expect(unknownCommand.stderr).toContain('Unknown command "frobnicate"');
    const unknownOption = await run('validate', 'x', '--nope');
    expect(unknownOption.code).toBe(2);
    expect(unknownOption.stderr).toContain('--nope');
  });

  it('reports missing or extra arguments with the command usage', async () => {
    const missing = await run('archive', 'only-one');
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('Usage: fogline-pack archive <packDir> <out.fogpack>');
    expect((await run('inspect', 'a', 'b')).code).toBe(2);
  });

  it('rejects out-of-range numbers and unknown formats', async () => {
    const markers = await run('demo', 'out', '--markers=-3');
    expect(markers.code).toBe(2);
    expect(markers.stderr).toContain('--markers must be a whole number');
    expect((await run('demo', 'out', '--seed', 'abc')).code).toBe(2);
    const format = await run('tiles', 'a.png', 'out', '--format', 'gif');
    expect(format.code).toBe(2);
    expect(format.stderr).toContain('--format must be webp or png');
  });
});

describe('io helpers', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });

  it('captures output and carries exit codes on errors', () => {
    const io = captureIO();
    io.out('a');
    io.err('b');
    expect(io.text()).toBe('a\nb');
    expect(new CliError('x').exitCode).toBe(1);
    expect(new CliError('x', 2).exitCode).toBe(2);
  });
});
