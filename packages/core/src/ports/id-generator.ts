/** Creates ids for user-created things such as personal pins. */
export interface IdGenerator {
  /** A new id, unique within the app's data and valid under the pack id grammar. */
  next(): string;
}
