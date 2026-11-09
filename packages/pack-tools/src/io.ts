/** Where a command writes. Injected so tests can capture output without spawning processes. */
export interface CliIO {
  out(line: string): void;
  err(line: string): void;
}

/** Writes to the real stdout and stderr. */
export const processIO: CliIO = {
  out: (line) => {
    process.stdout.write(`${line}\n`);
  },
  err: (line) => {
    process.stderr.write(`${line}\n`);
  },
};

/** Collects output in memory. */
export function captureIO(): CliIO & { stdout: string[]; stderr: string[]; text(): string } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
    text: () => [...stdout, ...stderr].join('\n'),
  };
}

export const EXIT_OK = 0;
/** The pack is invalid, or the command failed. */
export const EXIT_FAILURE = 1;
/** The command line was wrong. */
export const EXIT_USAGE = 2;

/** Raised for problems the user can fix; the message is printed without a stack trace. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number = EXIT_FAILURE,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit] ?? 'GB'}`;
}
