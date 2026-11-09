import { useId, useState, type ReactNode } from 'react';
import { Button } from '../shared/Button';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Dialog } from '../shared/Dialog';
import { plural } from '../shared/format';
import { IssueList } from '../shared/IssueList';
import type { HomeDialog, HomeScreenModel } from './use-home-screen';

function ImportChoice(props: { readonly model: HomeScreenModel }): ReactNode {
  const { actions } = props.model;
  const [copy, setCopy] = useState(false);
  const copyId = useId();
  return (
    <Dialog
      title="Import a pack"
      onClose={actions.close}
      footer={<Button onClick={actions.close}>Cancel</Button>}
    >
      <p className="text-muted">
        A pack is one game&apos;s map: tiles, categories and markers. Choose a pack folder or a
        .fogpack archive. Fogline checks it before adding it.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={() => {
            void actions.chooseAndImport('folder', copy);
          }}
        >
          Choose a pack folder…
        </Button>
        <label htmlFor={copyId} className="flex items-center gap-2 text-muted">
          <input
            id={copyId}
            type="checkbox"
            checked={copy}
            onChange={(event) => {
              setCopy(event.target.checked);
            }}
          />
          Copy the folder into the Fogline library (otherwise it is used where it is)
        </label>
        <Button
          onClick={() => {
            void actions.chooseAndImport('archive', false);
          }}
        >
          Choose a .fogpack archive…
        </Button>
      </div>
    </Dialog>
  );
}

/** The dialog the home screen currently shows, if any. */
export function HomeDialogs(props: {
  readonly model: HomeScreenModel;
  readonly dialog: HomeDialog;
}): ReactNode {
  const { model, dialog } = props;
  const { actions } = model;
  switch (dialog.kind) {
    case 'importChoice':
      return <ImportChoice model={model} />;

    case 'importResult':
      return (
        <Dialog
          title={dialog.title}
          onClose={actions.close}
          footer={
            <Button variant="primary" onClick={actions.close}>
              OK
            </Button>
          }
        >
          {dialog.errors.length > 0 && <p>Fix these problems in the pack, then import it again.</p>}
          <IssueList title={`Errors (${String(dialog.errors.length)})`} issues={dialog.errors} />
          <IssueList
            title={`Warnings (${String(dialog.warnings.length)})`}
            issues={dialog.warnings}
          />
        </Dialog>
      );

    case 'confirmUpdate':
      return (
        <ConfirmDialog
          title={`Update "${dialog.existing.title}"?`}
          confirmLabel="Update pack"
          onCancel={actions.close}
          onConfirm={() => {
            void actions.confirmUpdate(dialog.request);
          }}
        >
          <p>
            The library has version {dialog.existing.version}; this pack is version{' '}
            {dialog.incoming.version}. Updating replaces the pack. Your progress is kept.
          </p>
        </ConfirmDialog>
      );

    case 'remove':
      return (
        <ConfirmDialog
          title={`Remove "${dialog.card.entry.title}" from the library?`}
          confirmLabel="Remove"
          option="Also clear my progress for this pack"
          onCancel={actions.close}
          onConfirm={(clearProgress) => {
            void actions.remove(dialog.card, clearProgress);
          }}
        >
          <p>The pack files stay where they are. You can import the pack again at any time.</p>
        </ConfirmDialog>
      );

    case 'delete':
      return (
        <ConfirmDialog
          title={`Delete the files of "${dialog.card.entry.title}"?`}
          confirmLabel="Move to trash"
          danger
          typeToConfirm="delete"
          option="Also clear my progress for this pack"
          onCancel={actions.close}
          onConfirm={(clearProgress) => {
            void actions.deleteFiles(dialog.card, clearProgress);
          }}
        >
          <p>This folder is moved to the system trash and the pack leaves the library:</p>
          <code className="block break-all rounded-md border border-border bg-background p-2">
            {dialog.card.entry.path}
          </code>
          <p className="text-muted">Your progress is kept unless you tick the box below.</p>
        </ConfirmDialog>
      );

    case 'reset':
      return (
        <ConfirmDialog
          title={`Reset progress for "${dialog.card.entry.title}"?`}
          confirmLabel="Reset progress"
          danger
          typeToConfirm="reset"
          onCancel={actions.close}
          onConfirm={() => {
            void actions.reset(dialog.card);
          }}
        >
          <p>This clears:</p>
          <ul className="list-inside list-disc">
            <li>{plural(dialog.summary.collected, 'collected marker')}</li>
            <li>{plural(dialog.summary.customMarkers, 'personal pin')}</li>
            <li>
              {plural(dialog.summary.hiddenCategories, 'hidden category', 'hidden categories')}
            </li>
          </ul>
          <p className="text-muted">
            The pack and its library entry are kept. Export your progress first if you may want it
            back.
          </p>
        </ConfirmDialog>
      );

    case 'importProgress': {
      const differs = dialog.data.packVersion !== dialog.pack.version;
      const collected = Object.keys(dialog.data.collected).length;
      return (
        <Dialog
          title={`Import progress into "${dialog.card.entry.title}"`}
          onClose={actions.close}
          footer={
            <>
              <Button onClick={actions.close}>Cancel</Button>
              <Button
                onClick={() => {
                  void actions.importProgress(dialog.card, dialog.pack, dialog.data, 'replace');
                }}
              >
                Replace
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void actions.importProgress(dialog.card, dialog.pack, dialog.data, 'merge');
                }}
              >
                Merge
              </Button>
            </>
          }
        >
          <p>
            The file holds {plural(collected, 'collected marker')} and{' '}
            {plural(dialog.data.customMarkers.length, 'personal pin')}, exported on{' '}
            {new Date(dialog.data.exportedAt).toLocaleDateString('en')}.
          </p>
          {differs && (
            <p className="text-danger">
              It was exported from pack version {dialog.data.packVersion}; you have version{' '}
              {dialog.pack.version}. Markers that no longer exist are skipped.
            </p>
          )}
          <p className="text-muted">
            <strong className="text-text">Merge</strong> keeps your current progress and adds the
            file&apos;s. <strong className="text-text">Replace</strong> discards your current
            progress for this pack.
          </p>
        </Dialog>
      );
    }

    case 'error':
      return (
        <Dialog
          title={dialog.title}
          onClose={actions.close}
          footer={
            <Button variant="primary" onClick={actions.close}>
              OK
            </Button>
          }
        >
          <p>{dialog.message}</p>
          {dialog.issues !== undefined && <IssueList title="Problems" issues={dialog.issues} />}
        </Dialog>
      );
  }
}
