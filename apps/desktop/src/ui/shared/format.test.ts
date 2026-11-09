import { describe, expect, it } from 'vitest';
import { formatLastOpened, percent, plural } from './format';

describe('formatLastOpened', () => {
  const now = new Date('2026-11-09T12:00:00');

  it('describes recent opens in words', () => {
    expect(formatLastOpened(undefined, now)).toBe('Never opened');
    expect(formatLastOpened('2026-11-09T08:00:00', now)).toBe('Opened today');
    expect(formatLastOpened('2026-11-08T23:00:00', now)).toBe('Opened yesterday');
    expect(formatLastOpened('2026-11-05T10:00:00', now)).toBe('Opened 4 days ago');
  });

  it('shows a date for older opens', () => {
    expect(formatLastOpened('2026-10-18T15:40:02', now)).toBe('Opened Oct 18, 2026');
  });
});

describe('number helpers', () => {
  it('computes percentages safely and pluralizes', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
    expect(plural(1, 'pin')).toBe('1 pin');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });
});
