// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OpenedPack } from '@fogline/core';
import type { ValidationIssue } from '@fogline/pack-format';
import { sampleLibraryEntry, sampleProgressRecord, samplePack } from '@fogline/core/testing';
import { createTestPlatform, type TestPlatform } from '../../test/test-services';
import { ServicesProvider } from '../services-context';
import { HomeScreen } from './HomeScreen';

const pack = samplePack();
const PACK_DIR = 'D:/packs/sample';
const warning: ValidationIssue = {
  severity: 'warning',
  path: 'markers.overworld[0].position',
  code: 'marker.outOfBounds',
  message: 'Marker "x" is outside map "overworld".',
};
const error: ValidationIssue = {
  severity: 'error',
  path: 'manifest.license',
  code: 'schema.invalid',
  message: 'The license field is required.',
};

function renderHome(platform: TestPlatform, onOpen: (opened: OpenedPack) => void = vi.fn()) {
  const user = userEvent.setup();
  render(
    <ServicesProvider services={platform.services}>
      <HomeScreen onOpen={onOpen} />
    </ServicesProvider>,
  );
  return { user };
}

async function card(title: string): Promise<HTMLElement> {
  return screen.findByRole('article', { name: title });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, title: string): Promise<void> {
  await user.click(
    within(await card(title)).getByRole('button', { name: `More actions for ${title}` }),
  );
}

const TITLE = 'Sample Game - Complete Map';

describe('empty library', () => {
  it('explains what a pack is and offers import', async () => {
    const { user } = renderHome(createTestPlatform());
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import a pack' }));
    expect(screen.getByRole('dialog', { name: 'Import a pack' })).toBeInTheDocument();
  });
});

describe('importing', () => {
  it('imports a folder and shows its card', async () => {
    const platform = createTestPlatform({ packs: { [PACK_DIR]: pack } });
    platform.files.pickerAnswers.push(PACK_DIR);
    const { user } = renderHome(platform);
    await user.click(await screen.findByRole('button', { name: 'Import pack' }));
    await user.click(screen.getByRole('button', { name: 'Choose a pack folder…' }));

    const imported = await card(TITLE);
    expect(within(imported).getByText('Sample Game')).toBeInTheDocument();
    expect(within(imported).getByText('Available')).toBeInTheDocument();
    expect(within(imported).getByText('Never opened')).toBeInTheDocument();
    expect(within(imported).getByText('0 / 9 collected')).toBeInTheDocument();
    // Decorative image (alt=""), so it has no accessible role; query the element itself.
    expect(imported.querySelector('img')).toHaveAttribute(
      'src',
      `appdata://thumbnails/${pack.id}.webp`,
    );
    expect(screen.getByRole('status')).toHaveTextContent(`Imported "${TITLE}".`);
    expect(platform.files.granted).toEqual([PACK_DIR]);
  });

  it('copies into the library when asked', async () => {
    const platform = createTestPlatform({ packs: { [PACK_DIR]: pack } });
    platform.files.pickerAnswers.push(PACK_DIR);
    const { user } = renderHome(platform);
    await user.click(await screen.findByRole('button', { name: 'Import pack' }));
    await user.click(screen.getByRole('checkbox', { name: /Copy the folder/ }));
    await user.click(screen.getByRole('button', { name: 'Choose a pack folder…' }));
    await card(TITLE);
    expect((await platform.library.get(pack.id))?.source).toBe('copied');
  });

  it('imports an archive', async () => {
    const platform = createTestPlatform();
    platform.reader.addPack(platform.files.nextExtractedPath(), pack);
    platform.files.pickerAnswers.push('D:/downloads/sample.fogpack');
    const { user } = renderHome(platform);
    await user.click(await screen.findByRole('button', { name: 'Import pack' }));
    await user.click(screen.getByRole('button', { name: 'Choose a .fogpack archive…' }));
    await card(TITLE);
  });

  it('shows warnings after a successful import', async () => {
    const platform = createTestPlatform();
    platform.reader.addPack(PACK_DIR, pack, [warning]);
    platform.files.pickerAnswers.push(PACK_DIR);
    const { user } = renderHome(platform);
    await user.click(await screen.findByRole('button', { name: 'Import pack' }));
    await user.click(screen.getByRole('button', { name: 'Choose a pack folder…' }));
    const dialog = await screen.findByRole('dialog', {
      name: `Imported "${TITLE}" with 1 warning`,
    });
    expect(within(dialog).getByText(warning.message)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(await card(TITLE)).toBeInTheDocument();
  });

  it('blocks an invalid pack and lists its errors', async () => {
    const platform = createTestPlatform();
    platform.reader.addInvalid(PACK_DIR, [error]);
    platform.files.pickerAnswers.push(PACK_DIR);
    const { user } = renderHome(platform);
    await user.click(await screen.findByRole('button', { name: 'Import pack' }));
    await user.click(screen.getByRole('button', { name: 'Choose a pack folder…' }));
    const dialog = await screen.findByRole('dialog', { name: 'This pack cannot be imported' });
    expect(within(dialog).getByText(error.message)).toBeInTheDocument();
    expect(within(dialog).getByText('schema.invalid at manifest.license')).toBeInTheDocument();
    expect(await platform.library.list()).toEqual([]);
  });

  it('asks before updating a pack that is already in the library', async () => {
    const platform = createTestPlatform({
      entries: [sampleLibraryEntry(pack.id, { path: PACK_DIR, title: TITLE, version: '1.0.0' })],
    });
    platform.files.addPath(PACK_DIR);
    platform.reader.addPack('E:/v2', samplePack({ version: '2.0.0' }));
    platform.files.pickerAnswers.push('E:/v2');
    const { user } = renderHome(platform);
    await user.click(await screen.findByRole('button', { name: 'Import pack' }));
    await user.click(screen.getByRole('button', { name: 'Choose a pack folder…' }));
    const dialog = await screen.findByRole('dialog', { name: `Update "${TITLE}"?` });
    expect(dialog).toHaveTextContent('The library has version 1.0.0; this pack is version 2.0.0.');
    await user.click(within(dialog).getByRole('button', { name: 'Update pack' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Updated');
    expect((await platform.library.get(pack.id))?.version).toBe('2.0.0');
  });

  it('does nothing when the picker is cancelled', async () => {
    const platform = createTestPlatform();
    platform.files.pickerAnswers.push(undefined);
    const { user } = renderHome(platform);
    await user.click(await screen.findByRole('button', { name: 'Import pack' }));
    await user.click(screen.getByRole('button', { name: 'Choose a pack folder…' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
  });
});

describe('library cards', () => {
  it('are sorted by last opened and show progress', async () => {
    const platform = createTestPlatform({
      entries: [
        sampleLibraryEntry('com.example.old', {
          title: 'Old pack',
          path: 'D:/old',
          lastOpenedAt: '2026-01-01T00:00:00Z',
        }),
        sampleLibraryEntry('com.example.new', {
          title: 'New pack',
          path: 'D:/new',
          lastOpenedAt: '2026-11-08T10:00:00Z',
        }),
      ],
      progress: [sampleProgressRecord('com.example.old')],
    });
    platform.files.addPath('D:/old', 'D:/new');
    renderHome(platform);
    const titles = (await screen.findAllByRole('article')).map((article) =>
      article.getAttribute('aria-label'),
    );
    expect(titles).toEqual(['New pack', 'Old pack']);
    expect(within(await card('Old pack')).getByText('2 / 9 collected')).toBeInTheDocument();
    expect(within(await card('Old pack')).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '22',
    );
    expect(within(await card('New pack')).getByText('Opened yesterday')).toBeInTheDocument();
  });

  it('opens an available pack', async () => {
    const platform = createTestPlatform({
      entries: [sampleLibraryEntry(pack.id, { title: TITLE, path: PACK_DIR })],
    });
    platform.files.addPath(PACK_DIR);
    platform.reader.addPack(PACK_DIR, pack);
    const onOpen = vi.fn();
    const { user } = renderHome(platform, onOpen);
    await user.click(within(await card(TITLE)).getByRole('button', { name: 'Open' }));
    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
    expect((onOpen.mock.calls[0]?.[0] as OpenedPack).pack.id).toBe(pack.id);
  });

  it('reports a pack that fails validation when opened', async () => {
    const platform = createTestPlatform({
      entries: [sampleLibraryEntry(pack.id, { title: TITLE, path: PACK_DIR })],
    });
    platform.files.addPath(PACK_DIR);
    platform.reader.addInvalid(PACK_DIR, [error], { packId: pack.id });
    const { user } = renderHome(platform);
    await user.click(within(await card(TITLE)).getByRole('button', { name: 'Open' }));
    const dialog = await screen.findByRole('dialog', { name: `Cannot open "${TITLE}"` });
    expect(within(dialog).getByText(error.message)).toBeInTheDocument();
  });
});

describe('missing packs', () => {
  function missingPlatform(): TestPlatform {
    const platform = createTestPlatform({
      entries: [sampleLibraryEntry(pack.id, { title: TITLE, path: 'E:/unplugged/sample' })],
    });
    return platform;
  }

  it('shows Unavailable and relinks with Locate', async () => {
    const platform = missingPlatform();
    platform.reader.addPack('F:/moved/sample', pack);
    platform.files.addPath('F:/moved/sample');
    platform.files.pickerAnswers.push('F:/moved/sample');
    const { user } = renderHome(platform);
    const missing = await card(TITLE);
    expect(within(missing).getByText('Unavailable')).toBeInTheDocument();
    await user.click(within(missing).getByRole('button', { name: 'Locate…' }));
    expect(await screen.findByRole('status')).toHaveTextContent('is available again');
    expect(within(await card(TITLE)).getByText('Available')).toBeInTheDocument();
    expect((await platform.library.get(pack.id))?.path).toBe('F:/moved/sample');
  });

  it('refuses a folder that holds another pack', async () => {
    const platform = missingPlatform();
    platform.reader.addPack('F:/other', samplePack({ id: 'com.example.other' }));
    platform.files.pickerAnswers.push('F:/other');
    const { user } = renderHome(platform);
    await user.click(within(await card(TITLE)).getByRole('button', { name: 'Locate…' }));
    const dialog = await screen.findByRole('dialog', { name: 'That folder does not match' });
    expect(dialog).toHaveTextContent('com.example.other');
    expect((await platform.library.get(pack.id))?.path).toBe('E:/unplugged/sample');
  });
});

describe('library actions', () => {
  function availablePlatform(): TestPlatform {
    const platform = createTestPlatform({
      entries: [sampleLibraryEntry(pack.id, { title: TITLE, path: PACK_DIR })],
      progress: [sampleProgressRecord(pack.id)],
    });
    platform.files.addPath(PACK_DIR);
    platform.reader.addPack(PACK_DIR, pack);
    return platform;
  }

  it('removes from the library, optionally clearing progress, without touching files', async () => {
    const platform = availablePlatform();
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Remove from library…' }));
    const dialog = screen.getByRole('dialog', { name: `Remove "${TITLE}" from the library?` });
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Also clear my progress for this pack' }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
    expect(await platform.progress.load(pack.id)).toBeUndefined();
    expect(platform.files.trashed).toEqual([]);
  });

  it('deletes pack files only after a typed confirmation that shows the folder', async () => {
    const platform = availablePlatform();
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Delete pack files…' }));
    const dialog = screen.getByRole('dialog', { name: `Delete the files of "${TITLE}"?` });
    expect(within(dialog).getByText(PACK_DIR)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Move to trash' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox'), 'delete');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(await screen.findByRole('status')).toHaveTextContent(`Moved ${PACK_DIR} to the trash.`);
    expect(platform.files.trashed).toEqual([PACK_DIR]);
    expect(await platform.progress.load(pack.id)).toBeDefined();
  });

  it('resets progress after showing the counts', async () => {
    const platform = availablePlatform();
    const { user } = renderHome(platform);
    expect(within(await card(TITLE)).getByText('2 / 9 collected')).toBeInTheDocument();
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Reset progress…' }));
    const dialog = await screen.findByRole('dialog', { name: `Reset progress for "${TITLE}"?` });
    expect(within(dialog).getByText('2 collected markers')).toBeInTheDocument();
    expect(within(dialog).getByText('1 personal pin')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox'), 'RESET');
    await user.click(within(dialog).getByRole('button', { name: 'Reset progress' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'cleared 2 collected markers and 1 personal pin',
    );
    expect(within(await card(TITLE)).getByText('0 / 9 collected')).toBeInTheDocument();
  });

  it('cancels a dialog with Escape', async () => {
    const platform = availablePlatform();
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Remove from library…' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await platform.library.get(pack.id)).toBeDefined();
  });

  it('exports progress to a chosen file', async () => {
    const platform = availablePlatform();
    platform.files.pickerAnswers.push('D:/backup/progress.json');
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Export progress…' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Exported progress to D:/backup/progress.json.',
    );
    const written = JSON.parse(await platform.files.readText('D:/backup/progress.json')) as {
      packId: string;
    };
    expect(written.packId).toBe(pack.id);
  });

  it('imports progress by merge', async () => {
    const platform = availablePlatform();
    await platform.files.writeText(
      'D:/backup/old.json',
      JSON.stringify({
        formatVersion: 1,
        packId: pack.id,
        packVersion: '0.9.0',
        exportedAt: '2026-10-01T10:00:00Z',
        collected: { 'cv-relic-001': '2026-10-01T10:00:00Z', 'gone-001': '2026-10-01T10:00:00Z' },
      }),
    );
    platform.files.pickerAnswers.push('D:/backup/old.json');
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Import progress…' }));
    const dialog = await screen.findByRole('dialog', { name: `Import progress into "${TITLE}"` });
    expect(dialog).toHaveTextContent(
      'It was exported from pack version 0.9.0; you have version 1.0.0.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Merged progress');
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 entry no longer in this pack were skipped.',
    );
    expect(within(await card(TITLE)).getByText('3 / 9 collected')).toBeInTheDocument();
  });

  it('refuses progress exported from another pack', async () => {
    const platform = availablePlatform();
    await platform.files.writeText(
      'D:/backup/other.json',
      JSON.stringify({
        formatVersion: 1,
        packId: 'com.example.other',
        packVersion: '1.0.0',
        exportedAt: '2026-10-01T10:00:00Z',
      }),
    );
    platform.files.pickerAnswers.push('D:/backup/other.json');
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Import progress…' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Progress not imported' });
    expect(dialog).toHaveTextContent('com.example.other');
  });

  it('explains a file that is not a progress export', async () => {
    const platform = availablePlatform();
    await platform.files.writeText('D:/notes.json', 'hello');
    platform.files.pickerAnswers.push('D:/notes.json');
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Import progress…' }));
    expect(
      await screen.findByRole('dialog', { name: 'Cannot import this file' }),
    ).toHaveTextContent('not valid JSON');
  });

  it('reports unexpected failures in a dialog', async () => {
    const platform = availablePlatform();
    platform.files.pickerAnswers.push('D:/backup/progress.json');
    platform.files.writeText = () => Promise.reject(new Error('Disk is full'));
    const { user } = renderHome(platform);
    await openMenu(user, TITLE);
    await user.click(screen.getByRole('menuitem', { name: 'Export progress…' }));
    expect(await screen.findByRole('dialog', { name: 'Something went wrong' })).toHaveTextContent(
      'Disk is full',
    );
  });
});
