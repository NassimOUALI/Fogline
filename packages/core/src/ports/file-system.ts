/**
 * File system access, split by role (interface segregation). Use cases depend on the role
 * they need; the desktop adapter implements the whole `FileSystem`.
 */

export interface PathChecker {
  exists(path: string): Promise<boolean>;
}

export interface Trash {
  /** Moves a file or folder to the system trash. Never deletes permanently. */
  moveToTrash(path: string): Promise<void>;
}

export interface AccessGrants {
  /** Grants the app lasting read access to a user-picked folder (Tauri scopes). */
  grantAccess(path: string): Promise<void>;
}

export interface PackStorage {
  /** Copies a pack folder into the app's library folder. Returns the new folder path. */
  copyIntoLibrary(folder: string, packId: string): Promise<string>;
  /** Extracts a `.fogpack` archive into a new folder inside the library folder. */
  extractArchive(archive: string): Promise<string>;
  /** Removes a folder the app itself created inside its library folder (a failed import). */
  discard(folder: string): Promise<void>;
}

export interface FileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

export interface FilePicker {
  pickFolder(): Promise<string | undefined>;
  pickFile(filters: readonly FileFilter[]): Promise<string | undefined>;
  pickSaveLocation(
    defaultName: string,
    filters: readonly FileFilter[],
  ): Promise<string | undefined>;
}

export interface TextFiles {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
}

export interface FileSystem
  extends PathChecker, Trash, AccessGrants, PackStorage, FilePicker, TextFiles {}
