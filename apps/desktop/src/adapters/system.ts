import type { Clock, IdGenerator } from '@fogline/core';

export const systemClock: Clock = { now: () => new Date() };

/** `pin-<uuid>`: valid under the pack id grammar and unique across devices. */
export const randomIdGenerator: IdGenerator = { next: () => `pin-${crypto.randomUUID()}` };
