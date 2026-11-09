import { useId, useState, type ReactNode } from 'react';
import type { LibraryCard } from '@fogline/core';
import { Button } from '../shared/Button';
import { formatLastOpened, percent } from '../shared/format';

export interface PackCardActions {
  readonly open: (card: LibraryCard) => void;
  readonly locate: (card: LibraryCard) => void;
  readonly requestRemove: (card: LibraryCard) => void;
  readonly requestDelete: (card: LibraryCard) => void;
  readonly requestReset: (card: LibraryCard) => void;
  readonly exportProgress: (card: LibraryCard) => void;
  readonly startImportProgress: (card: LibraryCard) => void;
}

/** One library entry: thumbnail, title, game, last opened, progress, availability. */
export function PackCard(props: {
  readonly card: LibraryCard;
  readonly now: Date;
  readonly thumbnailUrl?: string | undefined;
  readonly disabled: boolean;
  readonly actions: PackCardActions;
}): ReactNode {
  const { card, actions } = props;
  const { entry } = card;
  const available = entry.status === 'available';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const progress = percent(card.collected, card.total);

  const menuItem = (
    label: string,
    action: (card: LibraryCard) => void,
    danger = false,
  ): ReactNode => (
    <li key={label}>
      <button
        type="button"
        role="menuitem"
        className={`w-full rounded px-3 py-1.5 text-left text-sm hover:bg-surface-hover ${danger ? 'text-danger' : ''}`}
        onClick={() => {
          setMenuOpen(false);
          action(card);
        }}
      >
        {label}
      </button>
    </li>
  );

  return (
    <article
      aria-label={entry.title}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="aspect-[16/9] bg-backdrop">
        {props.thumbnailUrl === undefined ? (
          <div
            className="flex h-full items-center justify-center text-3xl font-bold text-muted"
            aria-hidden="true"
          >
            {entry.gameName.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <img
            src={props.thumbnailUrl}
            alt=""
            className={`h-full w-full object-cover ${available ? '' : 'opacity-40 grayscale'}`}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{entry.title}</h3>
            <p className="truncate text-sm text-muted">{entry.gameName}</p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${available ? 'border-accent text-accent' : 'border-danger text-danger'}`}
          >
            {available ? 'Available' : 'Unavailable'}
          </span>
        </div>
        <p className="text-xs text-muted">{formatLastOpened(entry.lastOpenedAt, props.now)}</p>
        <div>
          <div className="flex justify-between text-xs text-muted">
            <span>
              {card.collected} / {card.total} collected
            </span>
            <span>{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progress for ${entry.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-background"
          >
            <div className="h-full bg-accent" style={{ width: `${String(progress)}%` }} />
          </div>
        </div>
        <div className="relative mt-auto flex gap-2 pt-2">
          {available ? (
            <Button
              variant="primary"
              disabled={props.disabled}
              onClick={() => {
                actions.open(card);
              }}
            >
              Open
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={props.disabled}
              onClick={() => {
                actions.locate(card);
              }}
            >
              Locate…
            </Button>
          )}
          <Button
            variant="ghost"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={`More actions for ${entry.title}`}
            disabled={props.disabled}
            onClick={() => {
              setMenuOpen((value) => !value);
            }}
          >
            More…
          </Button>
          {menuOpen && (
            <ul
              id={menuId}
              role="menu"
              className="absolute bottom-full left-0 z-10 mb-1 min-w-56 rounded-lg border border-border bg-surface p-1 shadow-xl"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setMenuOpen(false);
                }
              }}
            >
              {!available && menuItem('Locate…', actions.locate)}
              {available && menuItem('Export progress…', actions.exportProgress)}
              {available && menuItem('Import progress…', actions.startImportProgress)}
              {menuItem('Reset progress…', actions.requestReset, true)}
              {menuItem('Remove from library…', actions.requestRemove)}
              {available && menuItem('Delete pack files…', actions.requestDelete, true)}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
