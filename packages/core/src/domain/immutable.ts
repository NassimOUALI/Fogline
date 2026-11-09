/**
 * Freezes an object graph so domain values cannot be mutated after creation.
 * Plain objects and arrays only; Maps and Sets are exposed through readonly types instead.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
