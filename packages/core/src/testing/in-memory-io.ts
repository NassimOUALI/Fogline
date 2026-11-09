import type { ValidationIssue } from '@fogline/pack-format';
import type { GameMap, Pack } from '../domain/pack';
import type { Clock } from '../ports/clock';
import type { FileFilter, FileSystem } from '../ports/file-system';
import type { IdGenerator } from '../ports/id-generator';
import type {
  MapEvent,
  MapRenderer,
  RenderMarker,
  ShowMapInput,
  Viewport,
} from '../ports/map-renderer';
import type { PackReader, ReadPackResult } from '../ports/pack-reader';
import type { TileCoordinate, TileSource } from '../ports/tile-source';

const NO_MANIFEST: ValidationIssue = {
  severity: 'error',
  path: 'manifest',
  code: 'file.missing',
  message: 'File not found: manifest.json',
};

/** Pack reader over a table of `location -> result`. Unknown locations have no manifest. */
export class InMemoryPackReader implements PackReader {
  private readonly results = new Map<string, ReadPackResult>();
  private readonly ids = new Map<string, string>();
  /** Every location passed to `read`, in order. */
  readonly reads: string[] = [];

  addPack(location: string, pack: Pack, warnings: readonly ValidationIssue[] = []): this {
    this.results.set(location, { ok: true, pack, warnings });
    this.ids.set(location, pack.id);
    return this;
  }

  /** A location whose pack fails validation; `packId` makes its manifest id readable. */
  addInvalid(
    location: string,
    errors: readonly ValidationIssue[],
    options: { packId?: string; warnings?: readonly ValidationIssue[] } = {},
  ): this {
    this.results.set(location, { ok: false, errors, warnings: options.warnings ?? [] });
    if (options.packId === undefined) {
      this.ids.delete(location);
    } else {
      this.ids.set(location, options.packId);
    }
    return this;
  }

  removeLocation(location: string): this {
    this.results.delete(location);
    this.ids.delete(location);
    return this;
  }

  read(location: string): Promise<ReadPackResult> {
    this.reads.push(location);
    return Promise.resolve(
      this.results.get(location) ?? { ok: false, errors: [NO_MANIFEST], warnings: [] },
    );
  }

  readPackId(location: string): Promise<string | undefined> {
    return Promise.resolve(this.ids.get(location));
  }
}

/**
 * File system over a set of existing paths. Records trash, grants, copies and discards so
 * tests can assert exactly which paths a use case touched.
 */
export class InMemoryFileSystem implements FileSystem {
  readonly libraryRoot: string;
  readonly trashed: string[] = [];
  readonly granted: string[] = [];
  readonly discarded: string[] = [];
  readonly copies: { from: string; to: string }[] = [];
  /** Answers returned by the pickers, consumed in order. */
  readonly pickerAnswers: (string | undefined)[] = [];
  private readonly paths = new Set<string>();
  private readonly texts = new Map<string, string>();
  private extractions = 0;

  constructor(options: { paths?: readonly string[]; libraryRoot?: string } = {}) {
    this.libraryRoot = options.libraryRoot ?? '/app-data/library';
    for (const path of options.paths ?? []) {
      this.paths.add(path);
    }
  }

  addPath(...paths: string[]): this {
    for (const path of paths) {
      this.paths.add(path);
    }
    return this;
  }

  removePath(path: string): this {
    this.paths.delete(path);
    return this;
  }

  /** The folder the next `extractArchive` call will create. */
  nextExtractedPath(): string {
    return `${this.libraryRoot}/extracted-${String(this.extractions + 1)}`;
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.paths.has(path) || this.texts.has(path));
  }

  moveToTrash(path: string): Promise<void> {
    if (!this.paths.has(path)) {
      return Promise.reject(new Error(`Cannot trash missing path ${path}`));
    }
    this.paths.delete(path);
    this.trashed.push(path);
    return Promise.resolve();
  }

  grantAccess(path: string): Promise<void> {
    this.granted.push(path);
    return Promise.resolve();
  }

  copyIntoLibrary(folder: string, packId: string): Promise<string> {
    const to = `${this.libraryRoot}/${packId}`;
    this.copies.push({ from: folder, to });
    this.paths.add(to);
    return Promise.resolve(to);
  }

  extractArchive(_archive: string): Promise<string> {
    const to = this.nextExtractedPath();
    this.extractions += 1;
    this.paths.add(to);
    return Promise.resolve(to);
  }

  discard(folder: string): Promise<void> {
    this.discarded.push(folder);
    this.paths.delete(folder);
    return Promise.resolve();
  }

  pickFolder(): Promise<string | undefined> {
    return Promise.resolve(this.pickerAnswers.shift());
  }

  pickFile(_filters: readonly FileFilter[]): Promise<string | undefined> {
    return Promise.resolve(this.pickerAnswers.shift());
  }

  pickSaveLocation(
    _defaultName: string,
    _filters: readonly FileFilter[],
  ): Promise<string | undefined> {
    return Promise.resolve(this.pickerAnswers.shift());
  }

  readText(path: string): Promise<string> {
    const text = this.texts.get(path);
    return text === undefined
      ? Promise.reject(new Error(`No such file: ${path}`))
      : Promise.resolve(text);
  }

  writeText(path: string, content: string): Promise<void> {
    this.texts.set(path, content);
    return Promise.resolve();
  }
}

/** A clock that only moves when told to. */
export class FixedClock implements Clock {
  private current: number;

  constructor(iso = '2026-11-09T12:00:00.000Z') {
    this.current = Date.parse(iso);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(iso: string): void {
    this.current = Date.parse(iso);
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }
}

/** `custom-0001`, `custom-0002`, ... */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = 'custom-') {}

  next(): string {
    this.counter += 1;
    return `${this.prefix}${String(this.counter).padStart(4, '0')}`;
  }
}

/** Tile source that builds predictable fake URLs. */
export class FakeTileSource implements TileSource {
  constructor(private readonly types: readonly string[] = ['xyz']) {}

  supports(type: string): boolean {
    return this.types.includes(type);
  }

  tileUrl(packLocation: string, map: GameMap, tile: TileCoordinate): string {
    return `fake://${packLocation}/${map.tiles.path}/${String(tile.z)}/${String(tile.x)}/${String(tile.y)}`;
  }
}

/** Map renderer that records what it was asked to draw and lets tests emit events. */
export class RecordingMapRenderer implements MapRenderer {
  shown: ShowMapInput | undefined;
  markers: readonly RenderMarker[] = [];
  viewport: Viewport | undefined;
  highlighted: string | undefined;
  destroyed = false;
  private readonly listeners = new Set<(event: MapEvent) => void>();

  showMap(input: ShowMapInput): void {
    this.shown = input;
    this.viewport = input.viewport;
  }

  setMarkers(markers: readonly RenderMarker[]): void {
    this.markers = markers;
  }

  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  getViewport(): Viewport | undefined {
    return this.viewport;
  }

  highlight(markerId: string | undefined): void {
    this.highlighted = markerId;
  }

  subscribe(listener: (event: MapEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Simulates user interaction. */
  emit(event: MapEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
}
