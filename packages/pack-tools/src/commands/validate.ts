import {
  resolveLocalizedText,
  validatePack,
  type ValidationIssue,
  type ValidationResult,
} from '@fogline/pack-format';
import { EXIT_FAILURE, EXIT_OK, type CliIO } from '../io';
import { openPack } from '../sources/open-pack';

export interface ValidateOptions {
  readonly json?: boolean | undefined;
  readonly skipFiles?: boolean | undefined;
  readonly tileExtension?: string | undefined;
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

function printIssues(io: CliIO, title: string, issues: readonly ValidationIssue[]): void {
  if (issues.length === 0) {
    return;
  }
  io.out('');
  io.out(`${title} (${String(issues.length)}):`);
  for (const issue of issues) {
    io.out(`  [${issue.code}] ${issue.path}`);
    io.out(`      ${issue.message}`);
  }
}

/** Human-readable report: issues grouped by severity, then a one-line verdict. */
export function printValidationReport(io: CliIO, path: string, result: ValidationResult): void {
  io.out(`Validating ${path}`);
  if (result.pack !== undefined) {
    const { manifest } = result.pack;
    const title = resolveLocalizedText(
      manifest.title,
      manifest.defaultLanguage,
      manifest.defaultLanguage,
    );
    io.out(`Pack: ${title} (${manifest.id}) version ${manifest.version}`);
  }
  printIssues(io, 'Errors', result.errors);
  printIssues(io, 'Warnings', result.warnings);
  io.out('');
  const counts = `${plural(result.errors.length, 'error')}, ${plural(result.warnings.length, 'warning')}`;
  io.out(result.ok ? `Valid: ${counts}.` : `Invalid: ${counts}.`);
}

/** `fogline-pack validate <path>`: exit 0 when there are no errors, 1 otherwise. */
export async function runValidate(
  io: CliIO,
  path: string,
  options: ValidateOptions = {},
): Promise<number> {
  const opened = await openPack(path);
  const result = await validatePack(opened.source, {
    files: options.skipFiles === true ? 'skip' : 'check',
    ...(options.tileExtension === undefined ? {} : { tileExtension: options.tileExtension }),
  });
  if (options.json === true) {
    io.out(
      JSON.stringify(
        {
          path,
          ok: result.ok,
          pack:
            result.pack === undefined
              ? null
              : { id: result.pack.manifest.id, version: result.pack.manifest.version },
          errors: result.errors,
          warnings: result.warnings,
        },
        null,
        2,
      ),
    );
  } else {
    printValidationReport(io, path, result);
  }
  return result.ok ? EXIT_OK : EXIT_FAILURE;
}
