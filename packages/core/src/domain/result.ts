import type { ValidationIssue } from '@fogline/pack-format';

/** Every way a use case can fail. UI code switches on these, so treat them as API. */
export type ErrorCode =
  | 'library.notFound'
  | 'pack.unavailable'
  | 'pack.invalid'
  | 'pack.notFound'
  | 'pack.idMismatch'
  | 'pack.notSafeToDelete'
  | 'map.notFound'
  | 'marker.notFound'
  | 'personalMarker.notFound'
  | 'progress.wrongPack'
  | 'input.invalid';

export interface DomainError {
  readonly code: ErrorCode;
  /** A sentence a user can read. */
  readonly message: string;
  /** Validation issues when `code` is `pack.invalid`. */
  readonly issues?: readonly ValidationIssue[] | undefined;
}

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DomainError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(
  code: ErrorCode,
  message: string,
  issues?: readonly ValidationIssue[],
): Result<T> {
  return { ok: false, error: issues === undefined ? { code, message } : { code, message, issues } };
}
