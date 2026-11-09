import { stat } from 'node:fs/promises';
import {
  joinRelativePath,
  normalizeRelativePath,
  resolveLocalizedText,
  validatePack,
  type CategoryNodeData,
} from '@fogline/pack-format';
import { CliError, EXIT_OK, formatBytes, type CliIO } from '../io';
import { openPack } from '../sources/open-pack';

export interface PackSummary {
  readonly path: string;
  readonly kind: 'folder' | 'archive';
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly game: string;
  readonly license: string;
  readonly defaultLanguage: string;
  readonly maps: readonly {
    readonly id: string;
    readonly name: string;
    readonly size: string;
    readonly zoom: string;
    readonly tiles: string;
    /** Tile files present (xyz), or 1 for a pmtiles archive that exists. */
    readonly tileFiles: number;
    readonly markers: number;
  }[];
  readonly categories: { readonly groups: number; readonly leaves: number; readonly depth: number };
  readonly markers: number;
  readonly files: number;
  readonly sizeBytes?: number | undefined;
  readonly errors: number;
  readonly warnings: number;
}

function treeStats(nodes: readonly CategoryNodeData[], depth = 1): PackSummary['categories'] {
  let groups = 0;
  let leaves = 0;
  let maxDepth = nodes.length > 0 ? depth : 0;
  for (const node of nodes) {
    if (node.children === undefined) {
      leaves += 1;
    } else {
      groups += 1;
      const child = treeStats(node.children, depth + 1);
      groups += child.groups;
      leaves += child.leaves;
      maxDepth = Math.max(maxDepth, child.depth);
    }
  }
  return { groups, leaves, depth: maxDepth };
}

/** Reads a pack and summarizes it. Requires the pack's data files to parse. */
export async function inspectPack(path: string): Promise<PackSummary> {
  const opened = await openPack(path);
  const result = await validatePack(opened.source, { files: 'skip' });
  if (result.pack === undefined) {
    const first = result.errors[0];
    throw new CliError(
      `Cannot inspect ${path}: ${first === undefined ? 'unreadable pack' : `${first.path}: ${first.message}`}. Run validate for details.`,
    );
  }
  const { manifest, categories, markers } = result.pack;
  const language = manifest.defaultLanguage;
  const text = (value: Parameters<typeof resolveLocalizedText>[0]): string =>
    resolveLocalizedText(value, language, language);
  const files = await opened.listFiles();

  const maps = manifest.maps.map((map) => {
    const prefix = `${joinRelativePath(normalizeRelativePath(map.tiles.path))}/`;
    const tileFiles =
      map.tiles.type === 'pmtiles'
        ? files.filter((file) => file === normalizeRelativePath(map.tiles.path)).length
        : files.filter((file) => file.startsWith(prefix)).length;
    return {
      id: map.id,
      name: text(map.name),
      size: `${String(map.size.width)}x${String(map.size.height)}`,
      zoom: `${String(map.minZoom)}-${String(map.maxZoom)}`,
      tiles: `${map.tiles.type} ${map.tiles.path}`,
      tileFiles,
      markers: markers[map.id]?.length ?? 0,
    };
  });

  return {
    path,
    kind: opened.kind,
    id: manifest.id,
    title: text(manifest.title),
    version: manifest.version,
    game: manifest.game.name,
    license: manifest.license.spdx,
    defaultLanguage: language,
    maps,
    categories: treeStats(categories),
    markers: Object.values(markers).reduce((sum, list) => sum + list.length, 0),
    files: files.length,
    sizeBytes: opened.kind === 'archive' ? (await stat(path)).size : undefined,
    errors: result.errors.length,
    warnings: result.warnings.length,
  };
}

/** `fogline-pack inspect <path>`: prints a summary of a pack folder or archive. */
export async function runInspect(
  io: CliIO,
  path: string,
  options: { readonly json?: boolean | undefined } = {},
): Promise<number> {
  const summary = await inspectPack(path);
  if (options.json === true) {
    io.out(JSON.stringify(summary, null, 2));
    return EXIT_OK;
  }
  io.out(summary.title);
  io.out(`  id        ${summary.id}`);
  io.out(`  version   ${summary.version}`);
  io.out(`  game      ${summary.game}`);
  io.out(`  license   ${summary.license}`);
  io.out(`  language  ${summary.defaultLanguage}`);
  io.out(
    `  source    ${summary.kind}, ${String(summary.files)} files${summary.sizeBytes === undefined ? '' : `, ${formatBytes(summary.sizeBytes)}`}`,
  );
  io.out(
    `  categories ${String(summary.categories.groups)} groups, ${String(summary.categories.leaves)} leaves, depth ${String(summary.categories.depth)}`,
  );
  io.out(`  markers   ${String(summary.markers)}`);
  io.out('  maps:');
  for (const map of summary.maps) {
    io.out(
      `    ${map.id} "${map.name}" ${map.size}px, zoom ${map.zoom}, ${map.tiles} (${String(map.tileFiles)} files), ${String(map.markers)} markers`,
    );
  }
  if (summary.warnings > 0) {
    io.out(`  ${String(summary.warnings)} validation warning(s); run validate for details.`);
  }
  return EXIT_OK;
}
