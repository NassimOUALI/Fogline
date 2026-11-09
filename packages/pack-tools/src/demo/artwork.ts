/**
 * Procedural SVG artwork for the demo pack: a coordinate grid with labeled regions, plus simple
 * category icons. No external or game imagery.
 */
import type { LocalizedText } from '@fogline/pack-format';
import type { DemoMapSpec, Region } from './content';
import { SeededRandom } from './random';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function english(text: LocalizedText): string {
  return typeof text === 'string' ? text : (text.en ?? Object.values(text)[0] ?? '');
}

const GRID_STEP = 256;
const LABEL_STEP = 512;

/** The full-resolution map image as SVG (width x height pixels). */
export function mapArtworkSvg(map: DemoMapSpec, regions: readonly Region[], seed: number): string {
  const random = new SeededRandom(seed);
  const { width, height } = map;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="${map.ground}"/>`);

  // Speckle texture so zooming in shows detail.
  for (let i = 0; i < Math.round((width * height) / 9000); i += 1) {
    const r = random.range(2, 14).toFixed(1);
    const opacity = random.range(0.04, 0.12).toFixed(2);
    parts.push(
      `<circle cx="${random.range(0, width).toFixed(0)}" cy="${random.range(0, height).toFixed(0)}" r="${r}" fill="#ffffff" fill-opacity="${opacity}"/>`,
    );
  }

  for (const region of regions) {
    parts.push(
      `<ellipse cx="${region.cx.toFixed(0)}" cy="${region.cy.toFixed(0)}" rx="${region.rx.toFixed(0)}" ry="${region.ry.toFixed(0)}" fill="${region.color}" fill-opacity="0.75" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4"/>`,
    );
  }

  for (let x = 0; x <= width; x += GRID_STEP) {
    const major = x % (GRID_STEP * 4) === 0;
    parts.push(
      `<line x1="${String(x)}" y1="0" x2="${String(x)}" y2="${String(height)}" stroke="#ffffff" stroke-opacity="${major ? '0.28' : '0.12'}" stroke-width="${major ? '3' : '1.5'}"/>`,
    );
  }
  for (let y = 0; y <= height; y += GRID_STEP) {
    const major = y % (GRID_STEP * 4) === 0;
    parts.push(
      `<line x1="0" y1="${String(y)}" x2="${String(width)}" y2="${String(y)}" stroke="#ffffff" stroke-opacity="${major ? '0.28' : '0.12'}" stroke-width="${major ? '3' : '1.5'}"/>`,
    );
  }
  for (let x = 0; x < width; x += LABEL_STEP) {
    for (let y = 0; y < height; y += LABEL_STEP) {
      parts.push(
        `<text x="${String(x + 8)}" y="${String(y + 24)}" font-family="sans-serif" font-size="18" fill="#ffffff" fill-opacity="0.55">${String(x)},${String(y)}</text>`,
      );
    }
  }

  for (const region of regions) {
    parts.push(
      `<text x="${region.cx.toFixed(0)}" y="${region.cy.toFixed(0)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="56" font-weight="bold" fill="#ffffff" stroke="#000000" stroke-opacity="0.6" stroke-width="6" paint-order="stroke">${escapeXml(region.name)}</text>`,
    );
  }

  const caption = `${english(map.name)} - procedurally generated demo map`;
  parts.push(
    `<text x="24" y="${String(height - 24)}" font-family="sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.8">${escapeXml(caption)}</text>`,
  );
  parts.push(
    `<rect x="2" y="2" width="${String(width - 4)}" height="${String(height - 4)}" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="4"/>`,
  );
  parts.push('</svg>');
  return parts.join('\n');
}

/** 24x24 white glyphs; the app tints them with the category color. */
export const DEMO_ICONS: Readonly<Record<string, string>> = {
  'icons/chest.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2" fill="#ffffff"/><path d="M3 10a9 5 0 0 1 18 0" fill="#ffffff"/><rect x="10.5" y="11" width="3" height="4" fill="#000000" fill-opacity="0.4"/></svg>\n',
  'icons/star.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8z" fill="#ffffff"/></svg>\n',
  'icons/flag.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="4" y="2" width="2" height="20" fill="#ffffff"/><path d="M6 3h13l-3 4.5 3 4.5H6z" fill="#ffffff"/></svg>\n',
};
