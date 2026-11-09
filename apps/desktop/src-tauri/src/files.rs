//! Plain file-system helpers with no Tauri dependency, so they can be unit tested.

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

/// Pack ids may contain `:`, which Windows forbids in file names.
pub fn folder_name_for_pack(pack_id: &str) -> Result<String, String> {
    let valid = !pack_id.is_empty()
        && pack_id.len() <= 128
        && pack_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | ':' | '-'))
        && !pack_id.starts_with('.');
    if !valid {
        return Err(format!("\"{pack_id}\" is not a valid pack id"));
    }
    Ok(pack_id.replace(':', "_"))
}

/// True when `path` is strictly inside `root` (both must exist).
pub fn is_strictly_inside(root: &Path, path: &Path) -> io::Result<bool> {
    let root = fs::canonicalize(root)?;
    let path = fs::canonicalize(path)?;
    Ok(path != root && path.starts_with(&root))
}

/// A folder that looks like a Fogline pack: it holds a `manifest.json`.
pub fn is_pack_folder(path: &Path) -> bool {
    path.is_dir() && path.join("manifest.json").is_file()
}

/// True for `/`, `C:\` and similar: never a pack folder, never deletable.
pub fn is_filesystem_root(path: &Path) -> bool {
    path.parent().is_none()
        || path
            .components()
            .filter(|c| matches!(c, Component::Normal(_)))
            .count()
            == 0
}

pub fn copy_dir_recursive(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// Copies `from` to `to`, replacing `to` only once the copy has fully succeeded.
pub fn replace_with_copy(from: &Path, to: &Path) -> io::Result<()> {
    let staging = to.with_extension("incoming");
    if staging.exists() {
        fs::remove_dir_all(&staging)?;
    }
    copy_dir_recursive(from, &staging)?;
    if to.exists() {
        fs::remove_dir_all(to)?;
    }
    fs::rename(&staging, to)
}

/// Extracts a zip into `dest`, refusing entries that would escape it ("zip slip").
pub fn extract_zip(archive: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(archive).map_err(|e| format!("Cannot open {}: {e}", archive.display()))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("{} is not a readable .fogpack archive: {e}", archive.display()))?;
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|e| e.to_string())?;
        let relative: PathBuf = entry
            .enclosed_name()
            .ok_or_else(|| format!("Archive entry \"{}\" escapes the pack folder", entry.name()))?;
        let target = dest.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut out = fs::File::create(&target).map_err(|e| e.to_string())?;
        io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn pack_folder_names_are_safe_on_windows() {
        assert_eq!(folder_name_for_pack("com.example:game").unwrap(), "com.example_game");
        assert!(folder_name_for_pack("../evil").is_err());
        assert!(folder_name_for_pack("a/b").is_err());
        assert!(folder_name_for_pack("").is_err());
    }

    #[test]
    fn detects_folders_inside_a_root() {
        let root = tempfile::tempdir().unwrap();
        let child = root.path().join("child");
        fs::create_dir(&child).unwrap();
        assert!(is_strictly_inside(root.path(), &child).unwrap());
        assert!(!is_strictly_inside(root.path(), root.path()).unwrap());
        assert!(!is_strictly_inside(&child, root.path()).unwrap());
    }

    #[test]
    fn recognizes_roots_and_pack_folders() {
        assert!(is_filesystem_root(Path::new("/")));
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_pack_folder(dir.path()));
        fs::write(dir.path().join("manifest.json"), "{}").unwrap();
        assert!(is_pack_folder(dir.path()));
        assert!(!is_filesystem_root(dir.path()));
    }

    #[test]
    fn replaces_a_folder_with_a_copy() {
        let dir = tempfile::tempdir().unwrap();
        let from = dir.path().join("from");
        fs::create_dir_all(from.join("data")).unwrap();
        fs::write(from.join("data/x.json"), "new").unwrap();
        let to = dir.path().join("to");
        fs::create_dir_all(&to).unwrap();
        fs::write(to.join("old.txt"), "old").unwrap();
        replace_with_copy(&from, &to).unwrap();
        assert_eq!(fs::read_to_string(to.join("data/x.json")).unwrap(), "new");
        assert!(!to.join("old.txt").exists());
    }

    #[test]
    fn refuses_zip_slip_entries() {
        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("evil.fogpack");
        let mut writer = zip::ZipWriter::new(fs::File::create(&archive).unwrap());
        writer
            .start_file::<_, ()>("../escape.txt", zip::write::FileOptions::default())
            .unwrap();
        writer.write_all(b"x").unwrap();
        writer.finish().unwrap();
        let err = extract_zip(&archive, &dir.path().join("out")).unwrap_err();
        assert!(err.contains("escapes"));
        assert!(!dir.path().join("escape.txt").exists());
    }
}
