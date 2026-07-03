use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde_json::{json, Map, Value};

use crate::usb::emit_progress;
use crate::usb::format::{
    backup_folders_path, backup_games_dir, backup_lists_path, backup_root, backup_saves_dir,
    backup_settings_path, local_covers_dir, local_roms_dir, local_saves_dir, sha256_file,
    walk_files, write_manifest, Categories, Contents, Manifest, FORMAT_VERSION,
};
use crate::utils::config::get_selected_list_id;
use crate::utils::database::query_json;

struct GameEntry {
    id: String,
    name: String,
    extension: String,
    core: Option<String>,
    filename: String,
    cover_art: bool,
    sha: String,
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("{}: {}", path.display(), e))
}

fn copy_file(src: &Path, dst: &Path) -> Result<(), String> {
    if let Some(parent) = dst.parent() {
        ensure_dir(parent)?;
    }
    fs::copy(src, dst)
        .map(|_| ())
        .map_err(|e| format!("copy {} -> {}: {}", src.display(), dst.display(), e))
}

fn build_game_entries() -> Vec<GameEntry> {
    let rows = query_json("SELECT * FROM roms", &[]);
    let total = rows.len();
    let mut entries = Vec::new();

    for (i, row) in rows.into_iter().enumerate() {
        emit_progress("hashing", i, total);
        let id = row
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let filename = row
            .get("filename")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if id.is_empty() || filename.is_empty() {
            continue;
        }

        let sha = match sha256_file(&local_roms_dir().join(&filename)) {
            Ok(s) => s,
            Err(_) => continue,
        };

        entries.push(GameEntry {
            id,
            name: row
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            extension: row
                .get("extension")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            core: row
                .get("core")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            filename,
            cover_art: row
                .get("cover_art")
                .and_then(|v| v.as_i64())
                .map(|n| n != 0)
                .unwrap_or(false),
            sha,
        });
    }

    entries
}

fn export_games(mountpoint: &Path, entries: &[GameEntry]) -> Result<usize, String> {
    let games_dir = backup_games_dir(mountpoint);
    ensure_dir(&games_dir)?;

    let total = entries.len();
    for (i, entry) in entries.iter().enumerate() {
        emit_progress("games", i, total);

        copy_file(
            &local_roms_dir().join(&entry.filename),
            &games_dir.join(format!("{}.rom", entry.sha)),
        )?;

        if entry.cover_art {
            let cover_src = local_covers_dir().join(format!("{}.jpg", entry.id));
            if cover_src.exists() {
                copy_file(
                    &cover_src,
                    &games_dir.join(format!("{}.cover.jpg", entry.sha)),
                )?;
            }
        }

        let meta = json!({
            "sha": entry.sha,
            "name": entry.name,
            "extension": entry.extension,
            "core": entry.core,
            "cover": entry.cover_art,
        });
        fs::write(
            games_dir.join(format!("{}.json", entry.sha)),
            serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }

    emit_progress("games", total, total);
    Ok(entries.len())
}

fn export_lists(mountpoint: &Path, id_to_sha: &HashMap<String, String>) -> Result<usize, String> {
    let lists = query_json("SELECT * FROM game_lists ORDER BY created_at ASC", &[]);
    let selected_id = get_selected_list_id();
    let mut selected_name: Option<String> = None;
    let mut out_lists: Vec<Value> = Vec::new();

    for list in &lists {
        let list_id = list
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let name = list
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let list_type = list
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("exclude")
            .to_string();
        let is_default = list
            .get("is_default")
            .and_then(|v| v.as_i64())
            .map(|n| n != 0)
            .unwrap_or(false);

        if list_id == selected_id {
            selected_name = Some(name.clone());
        }

        let items = query_json(
            "SELECT game_id FROM game_list_items WHERE list_id = ?",
            &[&list_id],
        );
        let item_shas: Vec<Value> = items
            .iter()
            .filter_map(|it| it.get("game_id").and_then(|v| v.as_str()))
            .filter_map(|gid| id_to_sha.get(gid).cloned())
            .map(Value::from)
            .collect();

        out_lists.push(json!({
            "name": name,
            "type": list_type,
            "is_default": is_default,
            "items": item_shas,
        }));
    }

    let path = backup_lists_path(mountpoint);
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let doc = json!({ "lists": out_lists, "selected": selected_name });
    fs::write(
        &path,
        serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(out_lists.len())
}

fn export_saves(mountpoint: &Path, id_to_sha: &HashMap<String, String>) -> Result<usize, String> {
    let saves_root = backup_saves_dir(mountpoint);
    ensure_dir(&saves_root)?;

    let folders = query_json(
        "SELECT uuid, name, isLocked, isDefault FROM save_folders ORDER BY isDefault DESC",
        &[],
    );

    let mut folder_docs: Vec<Value> = Vec::new();
    let mut file_count = 0;

    for folder in &folders {
        let uuid = folder
            .get("uuid")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if uuid.is_empty() {
            continue;
        }

        folder_docs.push(json!({
            "uuid": uuid,
            "name": folder.get("name").cloned().unwrap_or(Value::Null),
            "isLocked": folder.get("isLocked").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
            "isDefault": folder.get("isDefault").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
        }));

        let folder_dir = local_saves_dir().join(&uuid);
        if !folder_dir.exists() {
            continue;
        }

        let mut files = Vec::new();
        walk_files(&folder_dir, &folder_dir, &mut files);

        for (rel, abs) in files {
            let mut dest_rel: Option<String> = None;
            for (gid, sha) in id_to_sha {
                if rel.contains(gid.as_str()) {
                    dest_rel = Some(rel.replace(gid.as_str(), sha));
                    break;
                }
            }
            let dest_rel = match dest_rel {
                Some(r) => r,
                None => continue,
            };

            copy_file(&abs, &saves_root.join(&uuid).join(&dest_rel))?;
            file_count += 1;
            emit_progress("saves", file_count, file_count);
        }
    }

    let path = backup_folders_path(mountpoint);
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(
        &path,
        serde_json::to_string_pretty(&Value::from(folder_docs)).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(file_count)
}

fn export_settings(mountpoint: &Path) -> Result<usize, String> {
    let rows = query_json("SELECT key, value FROM config", &[]);
    let mut obj = Map::new();
    for row in &rows {
        if let Some(key) = row.get("key").and_then(|v| v.as_str()) {
            obj.insert(
                key.to_string(),
                row.get("value").cloned().unwrap_or(Value::Null),
            );
        }
    }

    let path = backup_settings_path(mountpoint);
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let len = obj.len();
    fs::write(
        &path,
        serde_json::to_string_pretty(&Value::Object(obj)).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(len)
}

pub fn run_export(mountpoint: &Path, cats: &Categories, created_at: &str) -> Result<Value, String> {
    if !cats.any() {
        return Err("No categories selected".to_string());
    }

    let root = backup_root(mountpoint);
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|e| format!("clear backup dir: {}", e))?;
    }
    ensure_dir(&root)?;

    let entries = if cats.needs_game_map() {
        build_game_entries()
    } else {
        Vec::new()
    };
    let id_to_sha: HashMap<String, String> = entries
        .iter()
        .map(|e| (e.id.clone(), e.sha.clone()))
        .collect();

    let mut contents = Contents::default();
    if cats.games {
        contents.games = export_games(mountpoint, &entries)?;
    }
    if cats.lists {
        contents.lists = export_lists(mountpoint, &id_to_sha)?;
    }
    if cats.saves {
        contents.saves = export_saves(mountpoint, &id_to_sha)?;
    }
    if cats.settings {
        contents.settings = export_settings(mountpoint)?;
    }

    write_manifest(
        mountpoint,
        &Manifest {
            version: FORMAT_VERSION,
            created_at: created_at.to_string(),
            contents,
        },
    )?;

    Ok(json!({
        "games": contents.games,
        "saves": contents.saves,
        "lists": contents.lists,
        "settings": contents.settings,
    }))
}
