use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use crate::utils::config::{get_selected_list_id, has_config};
use crate::utils::database::{execute, query_json, query_one_json};
use crate::utils::emulation::find_core_by_extension;
use crate::utils::ids::random_hex_id;
use crate::utils::loader::download_game_cover;
use crate::utils::paths::cwd;

pub fn enrich_game_with_console(game: Option<Map<String, Value>>) -> Option<Map<String, Value>> {
    let mut game = game?;

    let extension = game
        .get("extension")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let core_pref = game
        .get("core")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let core = match core_pref {
        Some(ref c) => find_core_by_extension(&extension, Some(c)),
        None => find_core_by_extension(&extension, None),
    };

    let console = match core {
        Some(c) => {
            if !c.display_name.is_empty() {
                c.display_name
            } else if !c.systemname.is_empty() {
                c.systemname
            } else {
                String::new()
            }
        }
        None => String::new(),
    };

    game.insert("console".to_string(), Value::from(console));
    Some(game)
}

fn rom_path(filename: &str) -> PathBuf {
    cwd().join("data").join("roms").join(filename)
}

fn cover_path(game_id: &str) -> PathBuf {
    cwd()
        .join("data")
        .join("covers")
        .join(format!("{}.jpg", game_id))
}

pub fn add_game(
    original_filename: &str,
    file_buffer: &[u8],
    game_name: Option<String>,
) -> Result<Map<String, Value>, String> {
    let extension = Path::new(original_filename)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let core = find_core_by_extension(&extension, None)
        .ok_or_else(|| format!("Unsupported file extension: {}", extension))?;

    let game_id = random_hex_id();
    let filename = format!("{}.{}", game_id, extension);

    fs::write(rom_path(&filename), file_buffer).map_err(|e| e.to_string())?;

    let name = game_name.unwrap_or_else(|| {
        Path::new(original_filename)
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default()
    });

    execute(
        "INSERT INTO roms (id, name, filename, extension, core) VALUES (?, ?, ?, ?, ?)",
        &[&game_id, &name, &filename, &extension, &core.core],
    );

    let console = if !core.display_name.is_empty() {
        core.display_name.clone()
    } else if !core.systemname.is_empty() {
        core.systemname.clone()
    } else {
        String::new()
    };

    if has_config("steamGridDbApiKey") {
        let name_clone = name.clone();
        let game_id_clone = game_id.clone();
        tokio::spawn(async move {
            let success = download_game_cover(&name_clone, &game_id_clone).await;
            if success {
                execute(
                    "UPDATE roms SET cover_art = 1 WHERE id = ?",
                    &[&game_id_clone],
                );
            }
        });
    }

    let mut result = Map::new();
    result.insert("id".to_string(), Value::from(game_id));
    result.insert("name".to_string(), Value::from(name));
    result.insert("filename".to_string(), Value::from(filename));
    result.insert("extension".to_string(), Value::from(extension));
    result.insert("core".to_string(), Value::from(core.core));
    result.insert("console".to_string(), Value::from(console));
    result.insert("cover_art".to_string(), Value::from(0));
    Ok(result)
}

pub fn get_all_games() -> Vec<Map<String, Value>> {
    query_json("SELECT * FROM roms ORDER BY name ASC", &[])
        .into_iter()
        .filter_map(|row| enrich_game_with_console(Some(row)))
        .collect()
}

pub fn get_filtered_games() -> Vec<Map<String, Value>> {
    let selected_list_id = get_selected_list_id();

    let list = query_one_json(
        "SELECT * FROM game_lists WHERE id = ?",
        &[&selected_list_id],
    );

    let list = match list {
        Some(l) => l,
        None => return get_all_games(),
    };

    let items = query_json(
        "SELECT game_id FROM game_list_items WHERE list_id = ?",
        &[&selected_list_id],
    );
    let list_game_ids: HashSet<String> = items
        .iter()
        .filter_map(|item| {
            item.get("game_id")
                .and_then(|v| v.as_str())
                .map(String::from)
        })
        .collect();

    let all_games = get_all_games();
    let list_type = list.get("type").and_then(|v| v.as_str()).unwrap_or("");

    if list_type == "include" {
        all_games
            .into_iter()
            .filter(|game| {
                game.get("id")
                    .and_then(|v| v.as_str())
                    .map(|id| list_game_ids.contains(id))
                    .unwrap_or(false)
            })
            .collect()
    } else {
        all_games
            .into_iter()
            .filter(|game| {
                game.get("id")
                    .and_then(|v| v.as_str())
                    .map(|id| !list_game_ids.contains(id))
                    .unwrap_or(true)
            })
            .collect()
    }
}

pub fn get_game_by_id(game_id: &str) -> Option<Map<String, Value>> {
    let game = query_one_json("SELECT * FROM roms WHERE id = ?", &[&game_id]);
    enrich_game_with_console(game)
}

pub fn update_game_name(game_id: &str, new_name: &str) -> bool {
    execute(
        "UPDATE roms SET name = ? WHERE id = ?",
        &[&new_name, &game_id],
    ) > 0
}

pub fn update_game_core(game_id: &str, core_name: &str) -> bool {
    execute(
        "UPDATE roms SET core = ? WHERE id = ?",
        &[&core_name, &game_id],
    ) > 0
}

pub fn delete_game(game_id: &str) -> bool {
    let game = match get_game_by_id(game_id) {
        Some(g) => g,
        None => return false,
    };

    if let Some(filename) = game.get("filename").and_then(|v| v.as_str()) {
        let path = rom_path(filename);
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    let cover_art = game
        .get("cover_art")
        .and_then(|v| v.as_i64())
        .map(|n| n != 0)
        .unwrap_or(false);
    if cover_art {
        let path = cover_path(game_id);
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    execute("DELETE FROM roms WHERE id = ?", &[&game_id]) > 0
}

pub fn upload_cover_art(game_id: &str, image_buffer: &[u8]) -> Result<bool, String> {
    get_game_by_id(game_id).ok_or_else(|| "Game not found".to_string())?;

    fs::write(cover_path(game_id), image_buffer).map_err(|e| e.to_string())?;

    Ok(execute("UPDATE roms SET cover_art = 1 WHERE id = ?", &[&game_id]) > 0)
}

pub fn get_cover_art_path(game_id: &str) -> Option<PathBuf> {
    let game = get_game_by_id(game_id)?;
    let cover_art = game
        .get("cover_art")
        .and_then(|v| v.as_i64())
        .map(|n| n != 0)
        .unwrap_or(false);
    if !cover_art {
        return None;
    }

    let path = cover_path(game_id);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

pub fn get_cover_art_base64(game_id: &str) -> Option<String> {
    let cover_path = get_cover_art_path(game_id)?;

    match fs::read(&cover_path) {
        Ok(buffer) => {
            use base64::Engine;
            Some(base64::engine::general_purpose::STANDARD.encode(buffer))
        }
        Err(e) => {
            eprintln!("Error reading cover art for game {}: {}", game_id, e);
            None
        }
    }
}
