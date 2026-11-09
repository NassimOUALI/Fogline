import { useCallback, useEffect, useState } from 'react';
import type {
  ImportMode,
  LibraryCard,
  LibraryEntry,
  OpenedPack,
  Pack,
  ProgressExport,
  ProgressSummary,
} from '@fogline/core';
import type { ValidationIssue } from '@fogline/pack-format';
import { parseProgressExport } from '../../services/progress-file';
import { useServices } from '../services-context';
import { plural } from '../shared/format';

export interface Notice {
  readonly tone: 'success' | 'error';
  readonly text: string;
}

export interface ImportRequest {
  readonly kind: 'folder' | 'archive';
  readonly location: string;
  readonly copyIntoLibrary: boolean;
}

export type HomeDialog =
  | { readonly kind: 'importChoice' }
  | {
      readonly kind: 'importResult';
      readonly title: string;
      readonly errors: readonly ValidationIssue[];
      readonly warnings: readonly ValidationIssue[];
    }
  | {
      readonly kind: 'confirmUpdate';
      readonly request: ImportRequest;
      readonly existing: LibraryEntry;
      readonly incoming: { readonly version: string; readonly title: string };
    }
  | { readonly kind: 'remove'; readonly card: LibraryCard }
  | { readonly kind: 'delete'; readonly card: LibraryCard }
  | { readonly kind: 'reset'; readonly card: LibraryCard; readonly summary: ProgressSummary }
  | {
      readonly kind: 'importProgress';
      readonly card: LibraryCard;
      readonly pack: Pack;
      readonly data: ProgressExport;
    }
  | {
      readonly kind: 'error';
      readonly title: string;
      readonly message: string;
      readonly issues?: readonly ValidationIssue[];
    };

const PACK_FILTERS = [{ name: 'Fogline pack', extensions: ['fogpack', 'zip'] }];
const PROGRESS_FILTERS = [{ name: 'Fogline progress', extensions: ['json'] }];

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type Action<T extends unknown[] = []> = (...args: T) => Promise<void>;

export interface HomeScreenModel {
  readonly cards: readonly LibraryCard[];
  readonly loading: boolean;
  /** What is running, for a progress line; `undefined` when idle. */
  readonly busy: string | undefined;
  readonly notice: Notice | undefined;
  readonly dialog: HomeDialog | undefined;
  readonly appDataUrl: (relativePath: string) => string;
  readonly now: Date;
  readonly actions: {
    readonly close: () => void;
    readonly chooseImport: () => void;
    readonly chooseAndImport: Action<['folder' | 'archive', boolean]>;
    readonly confirmUpdate: Action<[ImportRequest]>;
    readonly open: Action<[LibraryCard]>;
    readonly locate: Action<[LibraryCard]>;
    readonly requestRemove: (card: LibraryCard) => void;
    readonly remove: Action<[LibraryCard, boolean]>;
    readonly requestDelete: (card: LibraryCard) => void;
    readonly deleteFiles: Action<[LibraryCard, boolean]>;
    readonly requestReset: Action<[LibraryCard]>;
    readonly reset: Action<[LibraryCard]>;
    readonly exportProgress: Action<[LibraryCard]>;
    readonly startImportProgress: Action<[LibraryCard]>;
    readonly importProgress: Action<[LibraryCard, Pack, ProgressExport, ImportMode]>;
  };
}

/** State and actions of the library home screen. All rules live in the core use cases. */
export function useHomeScreen(onOpen: (opened: OpenedPack) => void): HomeScreenModel {
  const services = useServices();
  const { ports } = services;
  const [cards, setCards] = useState<readonly LibraryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | undefined>();
  const [dialog, setDialog] = useState<HomeDialog | undefined>();

  const refresh = useCallback(async () => {
    setCards(await services.listLibrary.execute());
    setLoading(false);
  }, [services]);

  // Initial load. The result is ignored if the screen unmounts first.
  useEffect(() => {
    let active = true;
    services.listLibrary.execute().then(
      (list) => {
        if (active) {
          setCards(list);
          setLoading(false);
        }
      },
      (error: unknown) => {
        if (active) {
          setLoading(false);
          setDialog({ kind: 'error', title: 'Cannot read the library', message: message(error) });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [services]);

  /** Runs one user action: shows progress, reports unexpected failures in a dialog. */
  const run = useCallback(async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    setNotice(undefined);
    try {
      await task();
    } catch (error) {
      setDialog({ kind: 'error', title: 'Something went wrong', message: message(error) });
    } finally {
      setBusy(undefined);
    }
  }, []);

  const close = useCallback(() => {
    setDialog(undefined);
  }, []);

  const importPack = useCallback(
    (request: ImportRequest, ifExists: 'ask' | 'update') =>
      run('Validating pack…', async () => {
        const outcome = await services.importPack.execute({
          location: request.location,
          kind: request.kind,
          copyIntoLibrary: request.copyIntoLibrary,
          ifExists,
        });
        if (outcome.status === 'invalid') {
          setDialog({
            kind: 'importResult',
            title: 'This pack cannot be imported',
            errors: outcome.errors,
            warnings: outcome.warnings,
          });
          return;
        }
        if (outcome.status === 'needsConfirmation') {
          setDialog({
            kind: 'confirmUpdate',
            request,
            existing: outcome.existing,
            incoming: outcome.incoming,
          });
          return;
        }
        const thumbnail = await ports.thumbnails.cacheFor(outcome.entry);
        if (thumbnail !== undefined) {
          await ports.library.save({ ...outcome.entry, thumbnail });
        }
        await refresh();
        const verb = outcome.status === 'updated' ? 'Updated' : 'Imported';
        if (outcome.warnings.length > 0) {
          setDialog({
            kind: 'importResult',
            title: `${verb} "${outcome.entry.title}" with ${plural(outcome.warnings.length, 'warning')}`,
            errors: [],
            warnings: outcome.warnings,
          });
        } else {
          setDialog(undefined);
          setNotice({ tone: 'success', text: `${verb} "${outcome.entry.title}".` });
        }
      }),
    [ports, refresh, run, services],
  );

  const chooseAndImport = useCallback(
    async (kind: 'folder' | 'archive', copyIntoLibrary: boolean) => {
      setDialog(undefined);
      const location =
        kind === 'folder'
          ? await ports.files.pickFolder()
          : await ports.files.pickFile(PACK_FILTERS);
      if (location !== undefined) {
        await importPack({ kind, location, copyIntoLibrary }, 'ask');
      }
    },
    [importPack, ports],
  );

  const open = useCallback(
    (card: LibraryCard) =>
      run('Opening pack…', async () => {
        const result = await services.openPack.execute({ packId: card.entry.packId });
        if (result.ok) {
          onOpen(result.value);
          return;
        }
        await refresh();
        setDialog({
          kind: 'error',
          title: `Cannot open "${card.entry.title}"`,
          message: result.error.message,
          ...(result.error.issues === undefined ? {} : { issues: result.error.issues }),
        });
      }),
    [onOpen, refresh, run, services],
  );

  const locate = useCallback(
    (card: LibraryCard) =>
      run('Checking folder…', async () => {
        const location = await ports.files.pickFolder();
        if (location === undefined) {
          return;
        }
        const result = await services.relinkPack.execute({ packId: card.entry.packId, location });
        await refresh();
        if (result.ok) {
          setNotice({ tone: 'success', text: `"${card.entry.title}" is available again.` });
        } else {
          setDialog({
            kind: 'error',
            title: 'That folder does not match',
            message: result.error.message,
          });
        }
      }),
    [ports, refresh, run, services],
  );

  const remove = useCallback(
    (card: LibraryCard, clearProgress: boolean) =>
      run('Removing…', async () => {
        setDialog(undefined);
        const result = await services.removeFromLibrary.execute({
          packId: card.entry.packId,
          clearProgress,
        });
        await refresh();
        if (result.ok) {
          setNotice({
            tone: 'success',
            text: `Removed "${card.entry.title}" from the library. Its files were not touched${clearProgress ? '; progress was cleared' : ' and progress was kept'}.`,
          });
        } else {
          setDialog({ kind: 'error', title: 'Cannot remove pack', message: result.error.message });
        }
      }),
    [refresh, run, services],
  );

  const deleteFiles = useCallback(
    (card: LibraryCard, clearProgress: boolean) =>
      run('Moving to trash…', async () => {
        setDialog(undefined);
        const result = await services.deletePackFiles.execute({
          packId: card.entry.packId,
          clearProgress,
        });
        await refresh();
        if (result.ok) {
          setNotice({ tone: 'success', text: `Moved ${result.value.trashedPath} to the trash.` });
        } else {
          setDialog({ kind: 'error', title: 'Nothing was deleted', message: result.error.message });
        }
      }),
    [refresh, run, services],
  );

  const requestReset = useCallback(
    (card: LibraryCard) =>
      run('Counting progress…', async () => {
        const summary = await services.resetProgress.preview({ packId: card.entry.packId });
        setDialog({ kind: 'reset', card, summary });
      }),
    [run, services],
  );

  const reset = useCallback(
    (card: LibraryCard) =>
      run('Resetting…', async () => {
        setDialog(undefined);
        const result = await services.resetProgress.execute({ packId: card.entry.packId });
        await refresh();
        if (result.ok) {
          const { cleared } = result.value;
          setNotice({
            tone: 'success',
            text: `Reset "${card.entry.title}": cleared ${plural(cleared.collected, 'collected marker')} and ${plural(cleared.customMarkers, 'personal pin')}.`,
          });
        }
      }),
    [refresh, run, services],
  );

  /** Reads the pack for actions that need its marker list; reports why when it cannot. */
  const loadPack = useCallback(
    async (card: LibraryCard): Promise<Pack | undefined> => {
      const read = await ports.reader.read(card.entry.path);
      if (read.ok) {
        return read.pack;
      }
      setDialog({
        kind: 'error',
        title: `Cannot read "${card.entry.title}"`,
        message: 'The pack has errors, so its progress cannot be exported or imported right now.',
        issues: read.errors,
      });
      return undefined;
    },
    [ports],
  );

  const exportProgress = useCallback(
    (card: LibraryCard) =>
      run('Exporting…', async () => {
        const pack = await loadPack(card);
        if (pack === undefined) {
          return;
        }
        const result = await services.exportProgress.execute({ pack });
        if (!result.ok) {
          setDialog({ kind: 'error', title: 'Export failed', message: result.error.message });
          return;
        }
        const target = await ports.files.pickSaveLocation(result.value.fileName, PROGRESS_FILTERS);
        if (target === undefined) {
          return;
        }
        await ports.files.writeText(target, result.value.json);
        setNotice({ tone: 'success', text: `Exported progress to ${target}.` });
      }),
    [loadPack, ports, run, services],
  );

  const startImportProgress = useCallback(
    (card: LibraryCard) =>
      run('Reading file…', async () => {
        const pack = await loadPack(card);
        if (pack === undefined) {
          return;
        }
        const file = await ports.files.pickFile(PROGRESS_FILTERS);
        if (file === undefined) {
          return;
        }
        const parsed = parseProgressExport(await ports.files.readText(file));
        if (!parsed.ok) {
          setDialog({ kind: 'error', title: 'Cannot import this file', message: parsed.message });
          return;
        }
        setDialog({ kind: 'importProgress', card, pack, data: parsed.data });
      }),
    [loadPack, ports, run],
  );

  const importProgress = useCallback(
    (card: LibraryCard, pack: Pack, data: ProgressExport, mode: ImportMode) =>
      run('Importing progress…', async () => {
        setDialog(undefined);
        const result = await services.importProgress.execute({ pack, data, mode });
        await refresh();
        if (!result.ok) {
          setDialog({
            kind: 'error',
            title: 'Progress not imported',
            message: result.error.message,
          });
          return;
        }
        const { report } = result.value;
        const skipped = report.skippedMarkerIds.length + report.skippedCustomMarkerIds.length;
        const parts = [
          `${mode === 'merge' ? 'Merged' : 'Replaced'} progress for "${card.entry.title}": ${plural(report.collectedImported, 'collected marker')}, ${plural(report.customMarkersImported, 'personal pin')}.`,
        ];
        if (skipped > 0) {
          parts.push(`${plural(skipped, 'entry', 'entries')} no longer in this pack were skipped.`);
        }
        setNotice({ tone: 'success', text: parts.join(' ') });
      }),
    [refresh, run, services],
  );

  return {
    cards,
    loading,
    busy,
    notice,
    dialog,
    appDataUrl: ports.appDataUrl,
    now: ports.clock.now(),
    actions: {
      close,
      chooseImport: () => {
        setDialog({ kind: 'importChoice' });
      },
      chooseAndImport,
      confirmUpdate: (request: ImportRequest) => importPack(request, 'update'),
      open,
      locate,
      requestRemove: (card: LibraryCard) => {
        setDialog({ kind: 'remove', card });
      },
      remove,
      requestDelete: (card: LibraryCard) => {
        setDialog({ kind: 'delete', card });
      },
      deleteFiles,
      requestReset,
      reset,
      exportProgress,
      startImportProgress,
      importProgress,
    },
  };
}
