import { useId, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

/**
 * Confirmation for library actions. `typeToConfirm` makes it a strong confirmation: the
 * button stays disabled until the user types that word.
 */
export function ConfirmDialog(props: {
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly typeToConfirm?: string;
  readonly option?: string;
  readonly onConfirm: (optionChecked: boolean) => void;
  readonly onCancel: () => void;
}): ReactNode {
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const inputId = useId();
  const optionId = useId();
  const needed = props.typeToConfirm;
  const ready = needed === undefined || typed.trim().toLowerCase() === needed.toLowerCase();

  return (
    <Dialog
      title={props.title}
      onClose={props.onCancel}
      footer={
        <>
          <Button onClick={props.onCancel}>Cancel</Button>
          <Button
            variant={props.danger === true ? 'danger' : 'primary'}
            disabled={!ready}
            onClick={() => {
              props.onConfirm(checked);
            }}
          >
            {props.confirmLabel}
          </Button>
        </>
      }
    >
      {props.children}
      {props.option !== undefined && (
        <label htmlFor={optionId} className="flex items-center gap-2">
          <input
            id={optionId}
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              setChecked(event.target.checked);
            }}
          />
          {props.option}
        </label>
      )}
      {needed !== undefined && (
        <div className="space-y-1">
          <label htmlFor={inputId} className="block text-muted">
            Type <strong className="text-text">{needed}</strong> to confirm.
          </label>
          <input
            id={inputId}
            value={typed}
            autoComplete="off"
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-text"
          />
        </div>
      )}
    </Dialog>
  );
}
