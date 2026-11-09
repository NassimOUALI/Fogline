const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Opened today", "Opened 3 days ago", "Opened Oct 18, 2026", or "Never opened". */
export function formatLastOpened(iso: string | undefined, now: Date): string {
  if (iso === undefined) {
    return 'Never opened';
  }
  const opened = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(opened)) / DAY_MS);
  if (days <= 0) {
    return 'Opened today';
  }
  if (days === 1) {
    return 'Opened yesterday';
  }
  if (days < 7) {
    return `Opened ${String(days)} days ago`;
  }
  return `Opened ${opened.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}`;
}

/** Whole-number percentage, 0 for an empty pack. */
export function percent(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}
