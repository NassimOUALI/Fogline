import { useEffect, useMemo, type ReactNode } from 'react';
import { localize, type OpenedPack } from '@fogline/core';
import { applyTheme } from '../../theme/theme';
import { useServices } from '../services-context';
import { Button } from '../shared/Button';
import { IssueList } from '../shared/IssueList';

/**
 * The open pack. Stage 5 shows its maps and progress per map and applies the pack palette;
 * the interactive map replaces the body in Stage 6.
 */
export function PackScreen(props: {
  readonly opened: OpenedPack;
  readonly onBack: () => void;
  readonly language?: string;
}): ReactNode {
  const { pack, progress, warnings, packUpdated } = props.opened;
  const services = useServices();
  const language = props.language ?? pack.defaultLanguage;
  const text = (value: Parameters<typeof localize>[0]): string =>
    localize(value, language, pack.defaultLanguage);

  useEffect(() => {
    applyTheme(document.documentElement, pack.palette, { animate: true });
    return () => {
      applyTheme(document.documentElement, undefined, { animate: true });
    };
  }, [pack]);

  const maps = useMemo(
    () =>
      pack.maps.map((map) => {
        const tree = services.buildCategoryTree.execute({ pack, mapId: map.id });
        return {
          map,
          total: tree.ok ? tree.value.count() : 0,
          collected: tree.ok ? tree.value.collectedCount(progress) : 0,
        };
      }),
    [pack, progress, services],
  );

  return (
    <div className="min-h-full bg-background text-text">
      <header className="flex items-center gap-4 border-b border-border px-8 py-4">
        <Button variant="ghost" onClick={props.onBack} aria-label="Back to library">
          ← Library
        </Button>
        <div>
          <p className="text-sm text-muted">{pack.game.name}</p>
          <h1 className="text-xl font-bold">{text(pack.title)}</h1>
        </div>
      </header>
      <main className="space-y-6 px-8 py-6">
        {packUpdated && (
          <p role="status" className="rounded-md border border-accent px-3 py-2 text-sm">
            This pack was updated to version {pack.version}. Your progress was kept.
          </p>
        )}
        <section aria-label="Maps">
          <h2 className="text-lg font-semibold">Maps</h2>
          <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {maps.map(({ map, total, collected }) => (
              <li key={map.id} className="rounded-xl border border-border bg-surface p-4">
                <h3 className="font-semibold">{text(map.name)}</h3>
                <p className="text-sm text-muted">
                  {map.size.width}×{map.size.height} px, zoom {map.minZoom}–{map.maxZoom}
                </p>
                <p className="mt-2 text-sm">
                  {collected} / {total} collected
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">The interactive map arrives in Stage 6.</p>
        </section>
        <IssueList title="Pack warnings" issues={warnings} />
      </main>
    </div>
  );
}
