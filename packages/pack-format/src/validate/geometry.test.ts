import { describe, expect, it } from 'vitest';
import { nativeZoomFor, sampleTileCoordinates, tileGridAt, tilePath } from './geometry';

describe('nativeZoomFor', () => {
  it('matches the example manifest', () => {
    expect(nativeZoomFor({ width: 4096, height: 3072 }, 256)).toBe(4);
    expect(nativeZoomFor({ width: 2048, height: 2048 }, 256)).toBe(3);
  });

  it('rounds up for non-power-of-two sizes and floors at zero', () => {
    expect(nativeZoomFor({ width: 3000, height: 1000 }, 256)).toBe(4);
    expect(nativeZoomFor({ width: 100, height: 100 }, 256)).toBe(0);
    expect(nativeZoomFor({ width: 512, height: 512 }, 512)).toBe(0);
  });
});

describe('tileGridAt', () => {
  const map = { size: { width: 4096, height: 3072 }, tileSize: 256, maxZoom: 4 };

  it('is full resolution at maxZoom', () => {
    expect(tileGridAt(map, 4)).toEqual({ zoom: 4, width: 4096, height: 3072, cols: 16, rows: 12 });
  });

  it('halves per zoom level and never drops below one tile', () => {
    expect(tileGridAt(map, 3)).toMatchObject({ width: 2048, height: 1536, cols: 8, rows: 6 });
    expect(tileGridAt(map, 0)).toMatchObject({ width: 256, height: 192, cols: 1, rows: 1 });
  });

  it('rounds partial tiles up', () => {
    const odd = { size: { width: 3000, height: 1000 }, tileSize: 256, maxZoom: 4 };
    expect(tileGridAt(odd, 4)).toMatchObject({ cols: 12, rows: 4 });
    expect(tileGridAt(odd, 3)).toMatchObject({ width: 1500, height: 500, cols: 6, rows: 2 });
  });
});

describe('sampleTileCoordinates', () => {
  it('samples first, center and last without duplicates', () => {
    const grid = { zoom: 2, width: 1024, height: 768, cols: 4, rows: 3 };
    expect(sampleTileCoordinates(grid)).toEqual([
      { z: 2, x: 0, y: 0 },
      { z: 2, x: 1, y: 1 },
      { z: 2, x: 3, y: 2 },
    ]);
  });

  it('collapses to one tile for a 1x1 grid', () => {
    const grid = { zoom: 0, width: 256, height: 192, cols: 1, rows: 1 };
    expect(sampleTileCoordinates(grid)).toEqual([{ z: 0, x: 0, y: 0 }]);
  });
});

describe('tilePath', () => {
  it('builds {folder}/{z}/{x}/{y}.{ext}', () => {
    expect(tilePath('maps/overworld/tiles', { z: 2, x: 3, y: 1 })).toBe(
      'maps/overworld/tiles/2/3/1.webp',
    );
    expect(tilePath('./maps/x/tiles/', { z: 0, x: 0, y: 0 }, 'png')).toBe('maps/x/tiles/0/0/0.png');
  });
});
