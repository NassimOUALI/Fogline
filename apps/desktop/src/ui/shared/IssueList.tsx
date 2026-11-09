import type { ValidationIssue } from '@fogline/pack-format';
import type { ReactNode } from 'react';

/** Validation issues as the CLI shows them: message, then code and location. */
export function IssueList(props: {
  readonly title: string;
  readonly issues: readonly ValidationIssue[];
}): ReactNode {
  if (props.issues.length === 0) {
    return null;
  }
  return (
    <section>
      <h3 className="font-semibold">{props.title}</h3>
      <ul className="mt-1 max-h-60 space-y-2 overflow-auto rounded-md border border-border bg-background p-2">
        {props.issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.path}-${String(index)}`}>
            <p>{issue.message}</p>
            <p className="text-xs text-muted">
              {issue.code} at {issue.path}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
