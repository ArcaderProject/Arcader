use std::fs;
use std::path::{Path, PathBuf};

use once_cell::sync::Lazy;
use serde::Serialize;
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::utils::database::{execute, query_json, query_one_json};
use crate::utils::paths::cwd;

static SAVES_BASE_PATH: Lazy<PathBuf> = Lazy::new(|| cwd().join("data").join("saves"));
const GLOBAL_PROFILE_UUID: &str = "global";
const GLOBAL_PROFILE_NAME: &str = "Global";

#[derive(Clone, Serialize)]
pub struct SaveFolder {
    pub uuid: String,
    pub name: String,
    #[serde(rename = "isLocked")]
    pub is_locked: bool,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    #[serde(rename = "createdAt")]
    pub created_at: Value,
}

fn truthy(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Number(n)) => n.as_i64().map(|i| i != 0).unwrap_or(false),
        Some(Value::Bool(b)) => *b,
        _ => false,
    }
}

fn folder_from_row(row: &Map<String, Value>) -> SaveFolder {
    SaveFolder {
        uuid: row
            .get("uuid")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        name: row
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        is_locked: truthy(row.get("isLocked")),
        is_active: truthy(row.get("isActive")),
        is_default: truthy(row.get("isDefault")),
        created_at: row.get("created_at").cloned().unwrap_or(Value::Null),
    }
}

fn ensure_saves_directory() {
    if !SAVES_BASE_PATH.exists() {
        fs::create_dir_all(&*SAVES_BASE_PATH).unwrap();
    }
}

pub fn ensure_global_profile() {
    ensure_saves_directory();

    let existing = query_one_json(
        "SELECT * FROM save_folders WHERE uuid = ?",
        &[&GLOBAL_PROFILE_UUID],
    );

    if existing.is_none() {
        execute(
            "INSERT INTO save_folders (uuid, name, isLocked, isActive, isDefault)\n             VALUES (?, ?, 0, 1, 1)",
            &[&GLOBAL_PROFILE_UUID, &GLOBAL_PROFILE_NAME],
        );
        println!("Created global save profile");
    }

    let global_path = SAVES_BASE_PATH.join(GLOBAL_PROFILE_UUID);
    if !global_path.exists() {
        fs::create_dir_all(&global_path).unwrap();
    }
}

pub fn get_all_save_folders() -> Vec<SaveFolder> {
    query_json(
        "SELECT * FROM save_folders ORDER BY isDefault DESC, created_at ASC",
        &[],
    )
    .iter()
    .map(folder_from_row)
    .collect()
}

pub fn get_save_folder(uuid: &str) -> Option<SaveFolder> {
    query_one_json("SELECT * FROM save_folders WHERE uuid = ?", &[&uuid])
        .map(|row| folder_from_row(&row))
}

pub fn get_active_save_folder() -> Option<SaveFolder> {
    let folder = query_one_json("SELECT * FROM save_folders WHERE isActive = 1", &[]);

    match folder {
        Some(row) => Some(folder_from_row(&row)),
        None => {
            ensure_global_profile();
            get_save_folder(GLOBAL_PROFILE_UUID)
        }
    }
}

pub fn create_save_folder(name: &str) -> Option<SaveFolder> {
    ensure_saves_directory();

    let uuid = Uuid::new_v4().to_string();

    execute(
        "INSERT INTO save_folders (uuid, name, isLocked, isActive, isDefault)\n         VALUES (?, ?, 0, 0, 0)",
        &[&uuid, &name],
    );

    let folder_path = SAVES_BASE_PATH.join(&uuid);
    fs::create_dir_all(&folder_path).unwrap();

    get_save_folder(&uuid)
}

pub fn rename_save_folder(uuid: &str, name: &str) -> Result<Option<SaveFolder>, String> {
    if uuid == GLOBAL_PROFILE_UUID {
        return Err("Cannot rename global profile".to_string());
    }

    execute(
        "UPDATE save_folders SET name = ? WHERE uuid = ?",
        &[&name, &uuid],
    );

    Ok(get_save_folder(uuid))
}

pub fn set_active_save_folder(uuid: &str) -> Result<Option<SaveFolder>, String> {
    let folder = get_save_folder(uuid);
    if folder.is_none() {
        return Err("Save folder not found".to_string());
    }

    execute("UPDATE save_folders SET isActive = 0", &[]);
    execute(
        "UPDATE save_folders SET isActive = 1 WHERE uuid = ?",
        &[&uuid],
    );

    Ok(get_save_folder(uuid))
}

pub fn lock_save_folder(uuid: &str) -> Option<SaveFolder> {
    execute(
        "UPDATE save_folders SET isLocked = 1 WHERE uuid = ?",
        &[&uuid],
    );
    get_save_folder(uuid)
}

pub fn unlock_save_folder(uuid: &str) -> Option<SaveFolder> {
    execute(
        "UPDATE save_folders SET isLocked = 0 WHERE uuid = ?",
        &[&uuid],
    );
    get_save_folder(uuid)
}

pub struct ClearResult {
    pub deleted_count: u64,
}

pub fn clear_save_folder(uuid: &str) -> Result<ClearResult, String> {
    let folder = get_save_folder(uuid).ok_or_else(|| "Save folder not found".to_string())?;
    if folder.is_locked {
        return Err("Cannot clear a locked save folder".to_string());
    }

    let folder_path = SAVES_BASE_PATH.join(uuid);

    if folder_path.exists() {
        let mut deleted_count: u64 = 0;

        if let Ok(entries) = fs::read_dir(&folder_path) {
            for entry in entries.filter_map(Result::ok) {
                let file_path = entry.path();
                match fs::metadata(&file_path) {
                    Ok(stats) => {
                        if stats.is_file() {
                            match fs::remove_file(&file_path) {
                                Ok(()) => {
                                    deleted_count += 1;
                                    println!("Deleted file: {}", file_path.display());
                                }
                                Err(e) => {
                                    eprintln!("Failed to delete {}: {}", file_path.display(), e)
                                }
                            }
                        } else if stats.is_dir() {
                            match fs::remove_dir_all(&file_path) {
                                Ok(()) => {
                                    deleted_count += 1;
                                    println!("Deleted directory: {}", file_path.display());
                                }
                                Err(e) => {
                                    eprintln!("Failed to delete {}: {}", file_path.display(), e)
                                }
                            }
                        }
                    }
                    Err(e) => eprintln!("Failed to delete {}: {}", file_path.display(), e),
                }
            }
        }

        println!(
            "Cleared {} items from save folder {} ({})",
            deleted_count, uuid, folder.name
        );
        return Ok(ClearResult { deleted_count });
    }

    println!("Save folder {} does not exist on disk", uuid);
    Ok(ClearResult { deleted_count: 0 })
}

pub fn delete_save_folder(uuid: &str) -> Result<(), String> {
    if uuid == GLOBAL_PROFILE_UUID {
        return Err("Cannot delete global profile".to_string());
    }

    let folder = get_save_folder(uuid).ok_or_else(|| "Save folder not found".to_string())?;

    if folder.is_active {
        let _ = set_active_save_folder(GLOBAL_PROFILE_UUID);
    }

    execute("DELETE FROM save_folders WHERE uuid = ?", &[&uuid]);

    let folder_path = SAVES_BASE_PATH.join(uuid);
    if folder_path.exists() {
        if let Err(e) = fs::remove_dir_all(&folder_path) {
            eprintln!("Failed to delete folder {}: {}", uuid, e);
        }
    }

    Ok(())
}

pub fn get_save_folder_path(uuid: &str) -> PathBuf {
    SAVES_BASE_PATH.join(uuid)
}

fn find_files_recursive(dir_path: &Path, pattern: &str) -> Vec<PathBuf> {
    let mut matching_files = Vec::new();

    if !dir_path.exists() {
        return matching_files;
    }

    let entries = match fs::read_dir(dir_path) {
        Ok(e) => e,
        Err(_) => return matching_files,
    };

    for entry in entries.filter_map(Result::ok) {
        let item_path = entry.path();
        let stats = match fs::metadata(&item_path) {
            Ok(s) => s,
            Err(_) => continue,
        };

        if stats.is_dir() {
            matching_files.extend(find_files_recursive(&item_path, pattern));
        } else if stats.is_file() {
            let base_name = item_path
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            if base_name.contains(pattern) {
                matching_files.push(item_path);
            }
        }
    }

    matching_files
}

fn calculate_total_size(file_paths: &[PathBuf]) -> u64 {
    let mut total_size: u64 = 0;

    for file_path in file_paths {
        if file_path.exists() {
            match fs::metadata(file_path) {
                Ok(stats) => total_size += stats.len(),
                Err(e) => eprintln!("Error reading file size for {}: {}", file_path.display(), e),
            }
        }
    }

    total_size
}

#[derive(Serialize)]
pub struct GameSave {
    #[serde(rename = "gameId")]
    pub game_id: String,
    #[serde(rename = "fileCount")]
    pub file_count: usize,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
}

pub fn get_games_in_save_folder(uuid: &str) -> Result<Vec<GameSave>, String> {
    get_save_folder(uuid).ok_or_else(|| "Save folder not found".to_string())?;

    let folder_path = get_save_folder_path(uuid);
    if !folder_path.exists() {
        return Ok(Vec::new());
    }

    let games = query_json("SELECT id FROM roms", &[]);

    let mut games_with_saves = Vec::new();

    for game in &games {
        let game_id = game
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let matching_files = find_files_recursive(&folder_path, &game_id);

        if !matching_files.is_empty() {
            let total_size = calculate_total_size(&matching_files);
            games_with_saves.push(GameSave {
                game_id,
                file_count: matching_files.len(),
                total_size,
            });
        }
    }

    Ok(games_with_saves)
}

pub struct DeleteSavesResult {
    pub deleted_count: u64,
    pub freed_space: u64,
}

pub fn delete_game_saves(uuid: &str, game_id: &str) -> Result<DeleteSavesResult, String> {
    let folder = get_save_folder(uuid).ok_or_else(|| "Save folder not found".to_string())?;
    if folder.is_locked {
        return Err("Cannot delete saves from a locked save folder".to_string());
    }

    let folder_path = get_save_folder_path(uuid);
    if !folder_path.exists() {
        return Ok(DeleteSavesResult {
            deleted_count: 0,
            freed_space: 0,
        });
    }

    let matching_files = find_files_recursive(&folder_path, game_id);
    let total_size = calculate_total_size(&matching_files);
    let mut deleted_count: u64 = 0;

    for file_path in &matching_files {
        match fs::remove_file(file_path) {
            Ok(()) => {
                deleted_count += 1;
                println!("Deleted game save file: {}", file_path.display());
            }
            Err(e) => eprintln!("Failed to delete {}: {}", file_path.display(), e),
        }
    }

    println!(
        "Deleted {} save file(s) for game {} from folder {} ({}), freed {} bytes",
        deleted_count, game_id, uuid, folder.name, total_size
    );

    Ok(DeleteSavesResult {
        deleted_count,
        freed_space: total_size,
    })
}
