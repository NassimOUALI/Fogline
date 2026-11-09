// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleLibraryEntry, sampleProgressRecord, samplePack } from '@fogline/core/testing';
import { DEFAULT_PALETTE } from '@fogline/pack-format';
import { createTestPlatform } from '../test/test-services';
import { App, NeedsDesktopShell, StartupError } from './App';
import { ServicesProvider } from './services-context';

const TITLE = 'Sample Game - Complete Map';

describe('App', () => {
  it('opens a pack, shows its maps with progress and palette, then returns to the library', async () => {
    const pack = samplePack({ version: '2.0.0' });
    const platform = createTestPlatform({
      entries: [sampleLibraryEntry(pack.id, { title: TITLE, path: 'D:/p' })],
      progress: [
        sampleProgressRecord(pack.id, {
          packVersionSeen: '1.0.0',
          collected: {
            'ow-chest-001': '2026-10-11T20:14:00.000Z',
            'cv-relic-001': '2026-10-11T20:14:00.000Z',
          },
        }),
      ],
    });
    platform.files.addPath('D:/p');
    platform.reader.addPack('D:/p', pack);
    const user = userEvent.setup();
    render(
      <ServicesProvider services={platform.services}>
        <App />
      </ServicesProvider>,
    );

    await user.click(
      within(await screen.findByRole('article', { name: TITLE })).getByRole('button', {
        name: 'Open',
      }),
    );
    expect(await screen.findByRole('heading', { name: TITLE, level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText('This pack was updated to version 2.0.0. Your progress was kept.'),
    ).toBeInTheDocument();
    const maps = screen.getByRole('region', { name: 'Maps' });
    expect(within(maps).getByText('Overworld').closest('li')).toHaveTextContent('1 / 6 collected');
    expect(within(maps).getByText('Caves').closest('li')).toHaveTextContent('1 / 3 collected');
    expect(document.documentElement.style.getPropertyValue('--fl-accent')).toBe('#c98a3c');

    await user.click(screen.getByRole('button', { name: 'Back to library' }));
    expect(await screen.findByRole('article', { name: TITLE })).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--fl-accent')).toBe(
      DEFAULT_PALETTE.accent,
    );
  });

  it('has screens for running outside the shell and for startup failures', () => {
    render(<NeedsDesktopShell />);
    expect(screen.getByText(/tauri dev/)).toBeInTheDocument();
    render(<StartupError error={new Error('no app data folder')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('no app data folder');
  });

  it('requires a services provider', () => {
    expect(() => render(<App />)).toThrow('useServices must be used inside <ServicesProvider>.');
  });
});
