//! Fogline desktop shell. The Rust side is deliberately thin: it only does what the webview
//! cannot do safely on its own (trash, archive extraction, copying folders, widening the file
//! access scope). All product logic lives in the TypeScript `core` package.

mod commands;
mod files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::path_exists,
            commands::grant_access,
            commands::move_to_trash,
            commands::copy_into_library,
            commands::extract_archive,
            commands::discard_library_folder,
            commands::cache_thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fogline");
}
