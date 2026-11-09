import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { FileMap } from '@fogline/pack-format';
import { main } from '../src/cli';
import { captureIO } from '../src/io';

const created: string[] = [];

/** A fresh temporary folder, removed by `cleanTempDirs`. */
export async function makeTempDir(label = 'fogline-test-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), label));
  created.push(dir);
  return dir;
}

export async function cleanTempDirs(): Promise<void> {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

export async function writeFileMap(dir: string, files: FileMap): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }
}

export interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs the CLI in-process with captured output. */
export async function run(...argv: string[]): Promise<RunResult> {
  const io = captureIO();
  const code = await main(argv, io);
  return { code, stdout: io.stdout.join('\n'), stderr: io.stderr.join('\n') };
}

export interface ZipEntryInfo {
  readonly name: string;
  /** 0 = stored, 8 = deflated. */
  readonly method: number;
}

/** Reads a zip's central directory (enough to check names and compression methods). */
export async function readZipDirectory(file: string): Promise<ZipEntryInfo[]> {
  const data = await readFile(file);
  let end = data.length - 22;
  while (end >= 0 && data.readUInt32LE(end) !== 0x06054b50) {
    end -= 1;
  }
  if (end < 0) {
    throw new Error('No end of central directory record');
  }
  const count = data.readUInt16LE(end + 10);
  let offset = data.readUInt32LE(end + 16);
  const entries: ZipEntryInfo[] = [];
  for (let i = 0; i < count; i += 1) {
    if (data.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Bad central directory entry');
    }
    const method = data.readUInt16LE(offset + 10);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    entries.push({ name: data.toString('utf8', offset + 46, offset + 46 + nameLength), method });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
