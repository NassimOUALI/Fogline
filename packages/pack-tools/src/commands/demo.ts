import { EXIT_OK, type CliIO } from '../io';
import { generateDemoPack, type DemoOptions } from '../demo/generate';

/** `fogline-pack demo <outDir>`: writes a valid demo pack with procedural imagery. */
export async function runDemo(
  io: CliIO,
  outDir: string,
  options: DemoOptions = {},
): Promise<number> {
  const started = Date.now();
  const summary = await generateDemoPack(outDir, options);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  io.out(`Demo pack written to ${summary.outDir} in ${seconds}s.`);
  for (const map of summary.maps) {
    io.out(`  map ${map.id}: ${String(map.tiles)} tiles, zoom 0-${String(map.maxZoom)}`);
  }
  io.out(`  ${String(summary.markers)} markers, ${String(summary.tiles)} tiles in total.`);
  io.out(`Check it with: fogline-pack validate ${outDir}`);
  return EXIT_OK;
}
