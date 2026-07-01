use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::usb::emit_progress;
use crate::usb::format::{
    backup_folders_path, backup_games_dir, backup_lists_path, backup_saves_dir,
    backup_settings_path, local_covers_dir, local_roms_dir, local_saves_dir, random_hex_id,
    sha256_file, walk_files, Categories,
};
use crate::utils::config::set_config;
use crate::utils::database::{execute, query_json, query_one_json};

fn existing_sha_to_id() -> HashMap<String, String> {
    let rows = query_json("SELECT id, filename FROM roms", &[]);
    let mut map = HashMap::new();
    for row in rows {
        let id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let filename = row.get("filename").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        if id.is_empty() || filename.is_empty() {
            continue;
        }
        if let Ok(sha) = sha256_file(&local_roms_dir().join(&filename)) {
            map.insert(sha, id);
        }
    }
    map
}

struct ImportedGames {
    added: usize,
    duplicates: usize,
    sha_to_id: HashMap<String, String>,
}

fn import_games(mountpoint: &Path, mut sha_to_id: HashMap<String, String>) -> ImportedGames {
    let games_dir = backup_games_dir(mountpoint);
    let mut added = 0;
    let mut duplicates = 0;

    let json_files: Vec<PathBuf> = match fs::read_dir(&games_dir) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|e| e.path())
            .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
            .collect(),
        Err(_) => Vec::new(),
    };

    let total = json_files.len();
    for (i, meta_path) in json_files.iter().enumerate() {
        emit_progress("games", i, total);

        let meta: Value = match fs::read_to_string(meta_path).ok().and_then(|s| serde_json::from_str(&s).ok()) {
            Some(v) => v,
            None => continue,
        };

        let sha = meta.get("sha").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        if sha.is_empty() {
            continue;
        }
        if sha_to_id.contains_key(&sha) {
            duplicates += 1;
            continue;
        }

        let name = meta.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let extension = meta.get("extension").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let core = meta.get("core").and_then(|v| v.as_str()).map(|s| s.to_string());
        let has_cover = meta.get("cover").and_then(|v| v.as_bool()).unwrap_or(false);

        let rom_src = games_dir.join(format!("{}.rom", sha));
        if !rom_src.exists() {
            continue;
        }

        let new_id = random_hex_id();
        let filename = format!("{}.{}", new_id, extension);
        if fs::copy(&rom_src, local_roms_dir().join(&filename)).is_err() {
            continue;
        }

        let mut cover_flag = 0i64;
        if has_cover {
            let cover_src = games_dir.join(format!("{}.cover.jpg", sha));
            if cover_src.exists() && fs::copy(&cover_src, local_covers_dir().join(format!("{}.jpg", new_id))).is_ok() {
                cover_flag = 1;
            }
        }

        execute(
            "INSERT INTO roms (id, name, filename, extension, core, cover_art) VALUES (?, ?, ?, ?, ?, ?)",
            &[&new_id, &name, &filename, &extension, &core, &cover_flag],
        );

        sha_to_id.insert(sha, new_id);
        added += 1;
    }

    emit_progress("games", total, total);
    ImportedGames { added, duplicates, sha_to_id }
}

fn import_lists(mountpoint: &Path, sha_to_id: &HashMap<String, String>) -> usize {
    let doc: Value = match fs::read_to_string(backup_lists_path(mountpoint))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
    {
        Some(v) => v,
        None => return 0,
    };

    let lists = doc.get("lists").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let mut created = 0;

    for list in &lists {
        let name = list.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        if name.is_empty() {
            continue;
        }
        let list_type = list.get("type").and_then(|v| v.as_str()).unwrap_or("exclude").to_string();

        let list_id = match query_one_json("SELECT id FROM game_lists WHERE name = ?", &[&name]) {
            Some(row) => row.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            None => {
                let id = random_hex_id();
                execute(
                    "INSERT INTO game_lists (id, name, type, is_default) VALUES (?, ?, ?, 0)",
                    &[&id, &name, &list_type],
                );
                created += 1;
                id
            }
        };

        if let Some(items) = list.get("items").and_then(|v| v.as_array()) {
            for sha in items.iter().filter_map(|v| v.as_str()) {
                if let Some(game_id) = sha_to_id.get(sha) {
                    execute(
                        "INSERT OR IGNORE INTO game_list_items (list_id, game_id) VALUES (?, ?)",
                        &[&list_id, game_id],
                    );
                }
            }
        }
    }

    if let Some(selected) = doc.get("selected").and_then(|v| v.as_str()) {
        if let Some(row) = query_one_json("SELECT id FROM game_lists WHERE name = ?", &[&selected]) {
            if let Some(id) = row.get("id").and_then(|v| v.as_str()) {
                set_config("selected_list_id", id);
            }
        }
    }

    created
}

fn import_saves(mountpoint: &Path, sha_to_id: &HashMap<String, String>) -> usize {
    let saves_root = backup_saves_dir(mountpoint);

    if let Some(folders) = fs::read_to_string(backup_folders_path(mountpoint))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.as_array().cloned())
    {
        for folder in &folders {
            let uuid = folder.get("uuid").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            if uuid.is_empty() {
                continue;
            }
            if query_one_json("SELECT 1 FROM save_folders WHERE uuid = ?", &[&uuid]).is_none() {
                let name = folder.get("name").and_then(|v| v.as_str()).unwrap_or("Imported").to_string();
                let is_locked = folder.get("isLocked").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
                let is_default = folder.get("isDefault").and_then(|v| v.as_bool()).unwrap_or(false) as i64;
                execute(
                    "INSERT INTO save_folders (uuid, name, isLocked, isActive, isDefault) VALUES (?, ?, ?, 0, ?)",
                    &[&uuid, &name, &is_locked, &is_default],
                );
            }
            let _ = fs::create_dir_all(local_saves_dir().join(&uuid));
        }
    }

    let mut copied = 0;
    let folder_dirs = match fs::read_dir(&saves_root) {
        Ok(e) => e.filter_map(Result::ok).map(|e| e.path()).filter(|p| p.is_dir()).collect::<Vec<_>>(),
        Err(_) => Vec::new(),
    };

    for folder_dir in folder_dirs {
        let uuid = match folder_dir.file_name().and_then(|s| s.to_str()) {
            Some(u) => u.to_string(),
            None => continue,
        };
        let _ = fs::create_dir_all(local_saves_dir().join(&uuid));

        let mut files = Vec::new();
        walk_files(&folder_dir, &folder_dir, &mut files);

        for (rel, abs) in files {
            let mut dest_rel: Option<String> = None;
            for (sha, gid) in sha_to_id {
                if rel.contains(sha.as_str()) {
                    dest_rel = Some(rel.replace(sha.as_str(), gid));
                    break;
                }
            }
            let dest_rel = match dest_rel {
                Some(r) => r,
                None => continue,
            };

            let dst = local_saves_dir().join(&uuid).join(&dest_rel);
            if let Some(parent) = dst.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if fs::copy(&abs, &dst).is_ok() {
                copied += 1;
                emit_progress("saves", copied, copied);
            }
        }
    }

    copied
}

fn import_settings(mountpoint: &Path) -> usize {
    let obj = match fs::read_to_string(backup_settings_path(mountpoint))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.as_object().cloned())
    {
        Some(o) => o,
        None => return 0,
    };

    let mut applied = 0;
    for (key, value) in &obj {
        if key == "selected_list_id" {
            continue;
        }
        let value_str = match value {
            Value::String(s) => s.clone(),
            Value::Null => continue,
            other => other.to_string(),
        };
        set_config(key, &value_str);
        applied += 1;
    }

    applied
}

pub fn run_import(mountpoint: &Path, cats: &Categories) -> Result<Value, String> {
    if !cats.any() {
        return Err("No categories selected".to_string());
    }

    let mut sha_to_id = existing_sha_to_id();

    let mut games_added = 0;
    let mut games_duplicate = 0;
    if cats.games {
        let result = import_games(mountpoint, sha_to_id);
        games_added = result.added;
        games_duplicate = result.duplicates;
        sha_to_id = result.sha_to_id;
    }

    let lists = if cats.lists { import_lists(mountpoint, &sha_to_id) } else { 0 };
    let saves = if cats.saves { import_saves(mountpoint, &sha_to_id) } else { 0 };
    let settings = if cats.settings { import_settings(mountpoint) } else { 0 };

    Ok(json!({
        "games_added": games_added,
        "games_duplicate": games_duplicate,
        "lists": lists,
        "saves": saves,
        "settings": settings,
    }))
}
