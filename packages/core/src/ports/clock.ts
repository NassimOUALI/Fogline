/** Source of the current time, so use cases are deterministic under test. */
export interface Clock {
  now(): Date;
}

/** Current time as an ISO 8601 UTC timestamp, the format stored in every file. */
export function nowIso(clock: Clock): string {
  return clock.now().toISOString();
}
