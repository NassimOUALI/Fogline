import type { ReactNode } from 'react';
import type { OpenedPack } from '@fogline/core';
import { Button } from '../shared/Button';
import { HomeDialogs } from './HomeDialogs';
import { PackCard } from './PackCard';
import { useHomeScreen } from './use-home-screen';

/** First screen: the library of packs, most recently opened first. */
export function HomeScreen(props: { readonly onOpen: (opened: OpenedPack) => void }): ReactNode {
  const model = useHomeScreen(props.onOpen);
  const { cards, loading, busy, notice, dialog, actions } = model;

  return (
    <div className="min-h-full bg-background text-text">
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold">Fogline</h1>
          <p className="text-sm text-muted">Offline maps for every game</p>
        </div>
        <Button variant="primary" disabled={busy !== undefined} onClick={actions.chooseImport}>
          Import pack
        </Button>
      </header>

      <div aria-live="polite" className="px-8 pt-4">
        {busy !== undefined && <p className="text-sm text-muted">{busy}</p>}
        {notice !== undefined && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-md border px-3 py-2 text-sm ${notice.tone === 'error' ? 'border-danger text-danger' : 'border-accent'}`}
          >
            {notice.text}
          </p>
        )}
      </div>

      <main className="px-8 py-6">
        {loading ? (
          <p className="text-muted">Loading library…</p>
        ) : cards.length === 0 ? (
          <section className="mx-auto mt-16 max-w-md text-center">
            <h2 className="text-xl font-semibold">Your library is empty</h2>
            <p className="mt-2 text-muted">
              A pack holds one game&apos;s interactive map: its tiles, categories and markers.
              Import a pack folder or a .fogpack file to start exploring. Everything works offline.
            </p>
            <Button variant="primary" className="mt-6" onClick={actions.chooseImport}>
              Import a pack
            </Button>
          </section>
        ) : (
          <ul
            className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6"
            aria-label="Library"
          >
            {cards.map((card) => (
              <li key={card.entry.packId}>
                <PackCard
                  card={card}
                  now={model.now}
                  thumbnailUrl={
                    card.entry.thumbnail === undefined
                      ? undefined
                      : model.appDataUrl(card.entry.thumbnail)
                  }
                  disabled={busy !== undefined}
                  actions={{
                    open: (c) => void actions.open(c),
                    locate: (c) => void actions.locate(c),
                    requestRemove: actions.requestRemove,
                    requestDelete: actions.requestDelete,
                    requestReset: (c) => void actions.requestReset(c),
                    exportProgress: (c) => void actions.exportProgress(c),
                    startImportProgress: (c) => void actions.startImportProgress(c),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {dialog !== undefined && <HomeDialogs model={model} dialog={dialog} />}
    </div>
  );
}
