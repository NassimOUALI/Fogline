//! Commands invoked from the webview (see `src/adapters/tauri-file-system.ts`).
//!
//! Every command re-checks its own safety conditions instead of trusting the caller:
//! the TypeScript core already checks them, this is the second line of defence.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_fs::FsExt;

use crate::files;

fn app_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn library_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("library");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Whether a path exists. Needs no file scope: it only answers yes or no.
#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Lets the webview read a user-chosen pack folder (file plugin and asset protocol for tiles).
/// The app calls this on import, on Locate, and for every library entry at launch.
#[tauri::command]
pub fn grant_access<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    let folder = PathBuf::from(&path);
    if files::is_filesystem_root(&folder) {
        return Err("Fogline does not open whole drives; choose the pack folder.".into());
    }
    app.fs_scope()
        .allow_directory(&folder, true)
        .map_err(|e| e.to_string())?;
    app.asset_protocol_scope()
        .allow_directory(&folder, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Sends a pack folder to the system trash. Refuses anything that is not a pack folder.
#[tauri::command]
pub fn move_to_trash(path: String) -> Result<(), String> {
    let folder = PathBuf::from(&path);
    if files::is_filesystem_root(&folder) {
        return Err("Refusing to move a drive root to the trash.".into());
    }
    if !files::is_pack_folder(&folder) {
        return Err(format!("{path} is not a Fogline pack folder; nothing was moved."));
    }
    trash::delete(&folder).map_err(|e| format!("Could not move {path} to the trash: {e}"))
}

/// Copies a pack folder into `<app data>/library/<pack id>` and returns the new path.
#[tauri::command]
pub fn copy_into_library<R: Runtime>(
    app: AppHandle<R>,
    folder: String,
    pack_id: String,
) -> Result<String, String> {
    let source = PathBuf::from(&folder);
    if !files::is_pack_folder(&source) {
        return Err(format!("{folder} is not a Fogline pack folder."));
    }
    let target = library_dir(&app)?.join(files::folder_name_for_pack(&pack_id)?);
    files::replace_with_copy(&source, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

/// Extracts a `.fogpack` into a new folder inside the library folder and returns its path.
#[tauri::command]
pub fn extract_archive<R: Runtime>(app: AppHandle<R>, archive: String) -> Result<String, String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let target = library_dir(&app)?.join(format!("extracted-{stamp}"));
    if let Err(error) = files::extract_zip(Path::new(&archive), &target) {
        let _ = fs::remove_dir_all(&target);
        return Err(error);
    }
    Ok(target.to_string_lossy().into_owned())
}

/// Permanently removes a folder the app created inside its own library folder (a failed or
/// cancelled import). Refuses any other path.
#[tauri::command]
pub fn discard_library_folder<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    let folder = PathBuf::from(&path);
    if !folder.exists() {
        return Ok(());
    }
    let library = library_dir(&app)?;
    let inside = files::is_strictly_inside(&library, &folder).map_err(|e| e.to_string())?;
    if !inside {
        return Err(format!("{path} is not inside the Fogline library folder; nothing was removed."));
    }
    fs::remove_dir_all(&folder).map_err(|e| e.to_string())
}

/// Copies a pack's map thumbnail into `<app data>/thumbnails/` so library cards show it even
/// when the pack is unavailable. Returns the path relative to the app data folder.
#[tauri::command]
pub fn cache_thumbnail<R: Runtime>(
    app: AppHandle<R>,
    source: String,
    pack_id: String,
) -> Result<Option<String>, String> {
    let from = PathBuf::from(&source);
    if !from.is_file() {
        return Ok(None);
    }
    let name = format!("{}.webp", files::folder_name_for_pack(&pack_id)?);
    let dir = app_data_dir(&app)?.join("thumbnails");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::copy(&from, dir.join(&name)).map_err(|e| e.to_string())?;
    Ok(Some(format!("thumbnails/{name}")))
}
