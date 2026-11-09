import { parseArgs, type ParseArgsConfig } from 'node:util';
import { runArchive } from './commands/archive';
import { runDemo } from './commands/demo';
import { runInspect } from './commands/inspect';
import { runTiles } from './commands/tiles';
import { runValidate } from './commands/validate';
import { CliError, EXIT_FAILURE, EXIT_OK, EXIT_USAGE, type CliIO } from './io';

export const CLI_NAME = 'fogline-pack';
export const CLI_VERSION = '0.1.0';

export const HELP = `${CLI_NAME} ${CLI_VERSION} - build and check Fogline map packs

Usage:
  ${CLI_NAME} validate <path> [--json] [--skip-files] [--tile-extension webp]
  ${CLI_NAME} inspect <path> [--json]
  ${CLI_NAME} archive <packDir> <out.fogpack>
  ${CLI_NAME} tiles <image> <outDir> [--id <mapId>] [--name <text>] [--order 1]
        [--tile-size 256] [--format webp|png] [--quality 90] [--min-zoom 0] [--pack-root <dir>]
  ${CLI_NAME} demo <outDir> [--markers 48] [--seed 1] [--force]

<path> is a pack folder or a .fogpack archive.
Exit codes: 0 success, 1 invalid pack or failure, 2 wrong command line.`;

interface CommandSpec {
  readonly positionals: readonly string[];
  readonly options: NonNullable<ParseArgsConfig['options']>;
  run(
    io: CliIO,
    args: readonly string[],
    values: Record<string, string | boolean | undefined>,
  ): Promise<number>;
}

function integer(
  values: Record<string, unknown>,
  name: string,
  min: number,
  max: number,
): number | undefined {
  const raw = values[name];
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CliError(
      `--${name} must be a whole number from ${String(min)} to ${String(max)}.`,
      EXIT_USAGE,
    );
  }
  return value;
}

function text(values: Record<string, unknown>, name: string): string | undefined {
  const raw = values[name];
  return typeof raw === 'string' ? raw : undefined;
}

function flag(values: Record<string, unknown>, name: string): boolean {
  return values[name] === true;
}

function arg(args: readonly string[], index: number): string {
  return args[index] ?? '';
}

const COMMANDS: Record<string, CommandSpec> = {
  validate: {
    positionals: ['path'],
    options: {
      json: { type: 'boolean' },
      'skip-files': { type: 'boolean' },
      'tile-extension': { type: 'string' },
    },
    run: (io, args, values) =>
      runValidate(io, arg(args, 0), {
        json: flag(values, 'json'),
        skipFiles: flag(values, 'skip-files'),
        tileExtension: text(values, 'tile-extension'),
      }),
  },
  inspect: {
    positionals: ['path'],
    options: { json: { type: 'boolean' } },
    run: (io, args, values) => runInspect(io, arg(args, 0), { json: flag(values, 'json') }),
  },
  archive: {
    positionals: ['packDir', 'out.fogpack'],
    options: {},
    run: (io, args) => runArchive(io, arg(args, 0), arg(args, 1)),
  },
  tiles: {
    positionals: ['image', 'outDir'],
    options: {
      id: { type: 'string' },
      name: { type: 'string' },
      order: { type: 'string' },
      'tile-size': { type: 'string' },
      format: { type: 'string' },
      quality: { type: 'string' },
      'min-zoom': { type: 'string' },
      'pack-root': { type: 'string' },
    },
    run: (io, args, values) => {
      const format = text(values, 'format') ?? 'webp';
      if (format !== 'webp' && format !== 'png') {
        throw new CliError('--format must be webp or png.', EXIT_USAGE);
      }
      return runTiles(io, arg(args, 0), arg(args, 1), {
        id: text(values, 'id'),
        name: text(values, 'name'),
        order: integer(values, 'order', -1000, 1000),
        tileSize: integer(values, 'tile-size', 64, 1024),
        format,
        quality: integer(values, 'quality', 1, 100),
        minZoom: integer(values, 'min-zoom', 0, 30),
        packRoot: text(values, 'pack-root'),
      });
    },
  },
  demo: {
    positionals: ['outDir'],
    options: {
      markers: { type: 'string' },
      seed: { type: 'string' },
      force: { type: 'boolean' },
    },
    run: (io, args, values) =>
      runDemo(io, arg(args, 0), {
        markers: integer(values, 'markers', 0, 1_000_000),
        seed: integer(values, 'seed', 0, 2 ** 31),
        force: flag(values, 'force'),
      }),
  },
};

/** Runs one CLI invocation and returns its exit code. Never calls `process.exit`. */
export async function main(argv: readonly string[], io: CliIO): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined) {
    io.err(HELP);
    return EXIT_USAGE;
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    io.out(HELP);
    return EXIT_OK;
  }
  if (command === '--version' || command === '-v') {
    io.out(CLI_VERSION);
    return EXIT_OK;
  }
  const spec = COMMANDS[command];
  if (spec === undefined) {
    io.err(`Unknown command "${command}".\n\n${HELP}`);
    return EXIT_USAGE;
  }

  let values: Record<string, string | boolean | undefined>;
  let positionals: string[];
  try {
    const parsed = parseArgs({
      args: [...rest],
      options: { ...spec.options, help: { type: 'boolean', short: 'h' } },
      allowPositionals: true,
      strict: true,
    });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    return EXIT_USAGE;
  }
  if (values.help === true) {
    io.out(HELP);
    return EXIT_OK;
  }
  if (positionals.length !== spec.positionals.length) {
    const expected = spec.positionals.map((name) => `<${name}>`).join(' ');
    io.err(`Usage: ${CLI_NAME} ${command} ${expected}\n\n${HELP}`);
    return EXIT_USAGE;
  }

  try {
    return await spec.run(io, positionals, values);
  } catch (error) {
    if (error instanceof CliError) {
      io.err(`Error: ${error.message}`);
      return error.exitCode;
    }
    io.err(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_FAILURE;
  }
}
