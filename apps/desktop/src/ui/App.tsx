import { useState, type ReactNode } from 'react';
import type { OpenedPack } from '@fogline/core';
import { HomeScreen } from './home/HomeScreen';
import { PackScreen } from './pack/PackScreen';

/** Two screens: the library, and the pack the user opened from it. */
export function App(): ReactNode {
  const [opened, setOpened] = useState<OpenedPack | undefined>();
  if (opened !== undefined) {
    return (
      <PackScreen
        opened={opened}
        onBack={() => {
          setOpened(undefined);
        }}
      />
    );
  }
  return <HomeScreen onOpen={setOpened} />;
}

/** Shown when the UI runs in a plain browser instead of the desktop shell. */
export function NeedsDesktopShell(): ReactNode {
  return (
    <main className="mx-auto mt-24 max-w-lg px-6 text-center">
      <h1 className="text-2xl font-bold">Fogline runs as a desktop app</h1>
      <p className="mt-3 text-muted">
        This page is the app&apos;s interface without its desktop shell, so it cannot reach your
        files. Start it with <code>pnpm --filter @fogline/desktop tauri dev</code>.
      </p>
    </main>
  );
}

export function StartupError(props: { readonly error: unknown }): ReactNode {
  return (
    <main className="mx-auto mt-24 max-w-lg px-6">
      <h1 className="text-2xl font-bold">Fogline could not start</h1>
      <p role="alert" className="mt-3 text-danger">
        {props.error instanceof Error ? props.error.message : String(props.error)}
      </p>
    </main>
  );
}
