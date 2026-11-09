import type { CategoryNodeData, Marker as MarkerData, ParsedPack } from '@fogline/pack-format';
import { createPack, type Pack } from '../domain/pack';

/**
 * A small fictional pack for tests, modeled on `examples/pack`.
 *
 * Tree (marker counts per map: overworld / caves):
 *   chests (group)
 *     chest-common          1 / 0
 *     chest-rare            1 / 1
 *   collectibles (group)
 *     shrines (group)
 *       shrine-fire         1 / 0
 *       shrine-water        1 / 0
 *     relics                1 / 1
 *   waypoints               1 / 1
 */
export const SAMPLE_CATEGORIES: CategoryNodeData[] = [
  {
    id: 'chests',
    name: { en: 'Chests', fr: 'Coffres' },
    icon: 'icons/chest.svg',
    children: [
      { id: 'chest-common', name: { en: 'Common' }, color: '#9aa3ad' },
      { id: 'chest-rare', name: { en: 'Rare' }, color: '#d9a441' },
    ],
  },
  {
    id: 'collectibles',
    name: { en: 'Collectibles' },
    color: '#8f5fd6',
    children: [
      {
        id: 'shrines',
        name: { en: 'Shrines' },
        children: [
          { id: 'shrine-fire', name: { en: 'Fire shrine' }, color: '#d9534f' },
          { id: 'shrine-water', name: { en: 'Water shrine' }, color: '#4a9bd9' },
        ],
      },
      { id: 'relics', name: { en: 'Relics' } },
    ],
  },
  { id: 'waypoints', name: { en: 'Waypoints' }, icon: 'icons/waypoint.svg', color: '#3fbf8f' },
];

export const SAMPLE_OVERWORLD_MARKERS: MarkerData[] = [
  {
    id: 'ow-chest-001',
    category: 'chest-common',
    position: { x: 900, y: 700 },
    name: { en: 'Roadside chest', fr: 'Coffre au bord de la route' },
    description: 'Found beside the old road.',
    attributes: [{ key: 'rarity', label: 'Rarity', value: 'Common' }],
  },
  {
    id: 'ow-chest-002',
    category: 'chest-rare',
    position: { x: 2600, y: 800 },
    name: { en: 'Hidden vault chest' },
    attributes: [
      { key: 'rarity', label: { en: 'Rarity', fr: 'Rareté' }, value: { en: 'Rare', fr: 'Rare' } },
      { key: 'gold', label: 'Gold', value: 250 },
      { key: 'locked', label: 'Locked', value: true },
    ],
    article: 'waterfall-secrets',
  },
  {
    id: 'ow-shrine-001',
    category: 'shrine-fire',
    position: { x: 2300, y: 1500 },
    name: { en: 'Ember shrine' },
  },
  {
    id: 'ow-shrine-002',
    category: 'shrine-water',
    position: { x: 1200, y: 2100 },
    name: { en: 'Tidal shrine' },
  },
  {
    id: 'ow-relic-001',
    category: 'relics',
    position: { x: 3300, y: 2400 },
    name: { en: 'Cracked tablet' },
    tags: ['region:east'],
  },
  {
    id: 'ow-waypoint-001',
    category: 'waypoints',
    position: { x: 1600, y: 1200 },
    name: { en: 'Central waypoint' },
  },
];

export const SAMPLE_CAVES_MARKERS: MarkerData[] = [
  {
    id: 'cv-chest-001',
    category: 'chest-rare',
    position: { x: 600, y: 1400 },
    name: { en: 'Deep cave chest' },
  },
  {
    id: 'cv-relic-001',
    category: 'relics',
    position: { x: 1500, y: 500 },
    name: { en: 'Buried idol' },
  },
  {
    id: 'cv-waypoint-001',
    category: 'waypoints',
    position: { x: 1000, y: 1000 },
    name: { en: 'Cave entrance waypoint' },
  },
];

export interface SamplePackOptions {
  readonly id?: string;
  readonly version?: string;
  readonly overworld?: MarkerData[];
  readonly caves?: MarkerData[];
  readonly categories?: CategoryNodeData[];
}

/** Validated-pack data as the pack-format validator would return it. */
export function samplePackData(options: SamplePackOptions = {}): ParsedPack {
  return {
    manifest: {
      formatVersion: 1,
      id: options.id ?? 'com.example.sample-game',
      game: { name: 'Sample Game', publisher: 'Example Studio' },
      title: { en: 'Sample Game - Complete Map', fr: 'Sample Game - Carte complète' },
      description: 'A fictional pack for tests.',
      version: options.version ?? '1.0.0',
      authors: [{ name: 'Fogline tests' }],
      license: { spdx: 'CC0-1.0' },
      defaultLanguage: 'en',
      theme: { palette: { accent: '#c98a3c' } },
      // Listed out of order on purpose: the pack sorts maps by `order`.
      maps: [
        {
          id: 'caves',
          name: { en: 'Caves', fr: 'Grottes' },
          order: 2,
          size: { width: 2048, height: 2048 },
          tileSize: 256,
          minZoom: 0,
          maxZoom: 3,
          tiles: { type: 'pmtiles', path: 'maps/caves/tiles.pmtiles' },
        },
        {
          id: 'overworld',
          name: { en: 'Overworld' },
          order: 1,
          size: { width: 4096, height: 3072 },
          tileSize: 256,
          minZoom: 0,
          maxZoom: 4,
          tiles: { type: 'xyz', path: 'maps/overworld/tiles' },
        },
      ],
      categories: 'data/categories.json',
      markers: { overworld: 'data/markers/overworld.json', caves: 'data/markers/caves.json' },
    },
    categories: options.categories ?? SAMPLE_CATEGORIES,
    markers: {
      overworld: options.overworld ?? SAMPLE_OVERWORLD_MARKERS,
      caves: options.caves ?? SAMPLE_CAVES_MARKERS,
    },
  };
}

export function samplePack(options: SamplePackOptions = {}): Pack {
  return createPack(samplePackData(options));
}

/** `count` generated markers spread over the overworld, cycling through every leaf. */
export function generatedMarkers(count: number): MarkerData[] {
  const leaves = [
    'chest-common',
    'chest-rare',
    'shrine-fire',
    'shrine-water',
    'relics',
    'waypoints',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `gen-${String(i).padStart(6, '0')}`,
    category: leaves[i % leaves.length] ?? 'relics',
    position: { x: (i * 37) % 4096, y: (i * 53) % 3072 },
    name: { en: `Generated marker ${String(i)}` },
  }));
}
