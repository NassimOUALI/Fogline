import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'input, button:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal dialog: labelled, focuses its first control, closes on Escape or backdrop click. */
export function Dialog(props: {
  readonly title: string;
  readonly children: ReactNode;
  readonly footer: ReactNode;
  readonly onClose: () => void;
}): ReactNode {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const { onClose } = props;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 text-text shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {props.title}
        </h2>
        <div className="mt-3 space-y-3 text-sm">{props.children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">{props.footer}</div>
      </div>
    </div>
  );
}
