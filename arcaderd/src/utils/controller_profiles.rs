use std::collections::HashMap;

use serde_json::{json, Map, Value};

use crate::utils::database::{execute, query_json, query_one_json, try_execute, with_transaction};
use crate::utils::ids::random_hex_id;

pub const DEFAULT_PROFILE_ID: &str = "default";

pub const RETROPAD_BINDS: &[(&str, &str)] = &[
    ("up", "Up"),
    ("down", "Down"),
    ("left", "Left"),
    ("right", "Right"),
    ("a", "A"),
    ("b", "B"),
    ("x", "X"),
    ("y", "Y"),
    ("l", "L"),
    ("r", "R"),
    ("l2", "L2"),
    ("r2", "R2"),
    ("l3", "L3"),
    ("r3", "R3"),
    ("select", "Select"),
    ("start", "Start"),
];

fn is_default_row(row: &Map<String, Value>) -> bool {
    row.get("is_default")
        .and_then(|v| v.as_i64())
        .map(|n| n != 0)
        .unwrap_or(false)
}

fn parse_bindings(row: &Map<String, Value>) -> Value {
    row.get("bindings")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .unwrap_or_else(|| json!({}))
}

fn row_to_api(mut row: Map<String, Value>) -> Value {
    let bindings = parse_bindings(&row);
    row.insert("bindings".to_string(), bindings);
    Value::Object(row)
}

pub fn list_profiles() -> Vec<Value> {
    let rows = query_json(
        "SELECT cp.*, \
                (SELECT COUNT(*) FROM controller_profile_games WHERE profile_id = cp.id) AS item_count \
         FROM controller_profiles cp \
         ORDER BY is_default DESC, name",
        &[],
    );
    rows.into_iter().map(row_to_api).collect()
}

pub fn get_profile(id: &str) -> Option<Value> {
    query_one_json("SELECT * FROM controller_profiles WHERE id = ?", &[&id]).map(row_to_api)
}

pub fn create_profile(name: &str) -> Result<Value, String> {
    let id = random_hex_id();
    match try_execute(
        "INSERT INTO controller_profiles (id, name, is_default, bindings) VALUES (?, ?, 0, '{}')",
        &[&id, &name],
    ) {
        Ok(_) => {}
        Err(message) => {
            if message.contains("UNIQUE constraint failed") {
                return Err("A profile with this name already exists".to_string());
            }
            return Err(message);
        }
    }
    get_profile(&id).ok_or_else(|| "Failed to load created profile".to_string())
}

pub fn rename_profile(id: &str, name: &str) -> Result<Value, String> {
    let row = query_one_json(
        "SELECT is_default FROM controller_profiles WHERE id = ?",
        &[&id],
    )
    .ok_or_else(|| "Profile not found".to_string())?;
    if is_default_row(&row) {
        return Err("Cannot rename the default profile".to_string());
    }

    match try_execute(
        "UPDATE controller_profiles SET name = ? WHERE id = ?",
        &[&name, &id],
    ) {
        Ok(_) => {}
        Err(message) => {
            if message.contains("UNIQUE constraint failed") {
                return Err("A profile with this name already exists".to_string());
            }
            return Err(message);
        }
    }
    get_profile(id).ok_or_else(|| "Failed to load updated profile".to_string())
}

pub fn delete_profile(id: &str) -> Result<(), String> {
    let row = query_one_json(
        "SELECT is_default FROM controller_profiles WHERE id = ?",
        &[&id],
    )
    .ok_or_else(|| "Profile not found".to_string())?;
    if is_default_row(&row) {
        return Err("Cannot delete the default profile".to_string());
    }
    execute("DELETE FROM controller_profiles WHERE id = ?", &[&id]);
    Ok(())
}

pub fn get_profile_game_ids(id: &str) -> Vec<String> {
    query_json(
        "SELECT game_id FROM controller_profile_games WHERE profile_id = ?",
        &[&id],
    )
    .into_iter()
    .filter_map(|row| {
        row.get("game_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    })
    .collect()
}

pub fn set_profile_games(id: &str, game_ids: &[String]) -> Result<usize, String> {
    if get_profile(id).is_none() {
        return Err("Profile not found".to_string());
    }

    with_transaction(|tx| {
        tx.execute(
            "DELETE FROM controller_profile_games WHERE profile_id = ?",
            [id],
        )?;

        let mut stmt = tx.prepare(
            "INSERT OR REPLACE INTO controller_profile_games (profile_id, game_id) VALUES (?, ?)",
        )?;
        let mut count = 0usize;
        for game_id in game_ids {
            stmt.execute([id, game_id.as_str()])?;
            count += 1;
        }
        Ok(count)
    })
}

pub fn save_binding(
    id: &str,
    player: u32,
    bind_key: &str,
    btn: &str,
    axis: &str,
) -> Result<(), String> {
    let mut bindings = match get_profile(id) {
        Some(p) => p
            .get("bindings")
            .cloned()
            .unwrap_or_else(|| json!({}))
            .as_object()
            .cloned()
            .unwrap_or_default(),
        None => return Err("Profile not found".to_string()),
    };

    let player_key = player.to_string();
    let player_map = bindings
        .entry(player_key)
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| "Corrupt bindings".to_string())?;

    player_map.insert(bind_key.to_string(), json!({ "btn": btn, "axis": axis }));

    let serialized = Value::Object(bindings).to_string();
    try_execute(
        "UPDATE controller_profiles SET bindings = ? WHERE id = ?",
        &[&serialized, &id],
    )?;
    Ok(())
}

#[allow(dead_code)]
pub fn set_bindings(id: &str, bindings: &Value) -> Result<(), String> {
    let serialized = bindings.to_string();
    try_execute(
        "UPDATE controller_profiles SET bindings = ? WHERE id = ?",
        &[&serialized, &id],
    )?;
    Ok(())
}

pub fn resolve_profile_for_game(game_id: &str) -> Option<Value> {
    let assigned = query_one_json(
        "SELECT profile_id FROM controller_profile_games WHERE game_id = ?",
        &[&game_id],
    )
    .and_then(|row| {
        row.get("profile_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });

    match assigned {
        Some(profile_id) => get_profile(&profile_id).or_else(|| get_profile(DEFAULT_PROFILE_ID)),
        None => get_profile(DEFAULT_PROFILE_ID),
    }
}

pub fn overrides_from_bindings(bindings: &Value) -> HashMap<String, String> {
    let mut overrides: HashMap<String, String> = HashMap::new();

    let players = match bindings.as_object() {
        Some(m) => m,
        None => return overrides,
    };

    for (player_key, binds) in players {
        let player_index: i64 = match player_key.parse::<i64>() {
            Ok(n) if n >= 1 => n,
            _ => continue,
        };

        let binds = match binds.as_object() {
            Some(b) => b,
            None => continue,
        };

        overrides.insert(
            format!("input_player{}_joypad_index", player_index),
            (player_index - 1).to_string(),
        );

        for (bind_key, mapping) in binds {
            let btn = mapping.get("btn").and_then(|v| v.as_str()).unwrap_or("nul");
            let axis = mapping
                .get("axis")
                .and_then(|v| v.as_str())
                .unwrap_or("nul");

            overrides.insert(
                format!("input_player{}_{}_btn", player_index, bind_key),
                btn.to_string(),
            );
            overrides.insert(
                format!("input_player{}_{}_axis", player_index, bind_key),
                axis.to_string(),
            );
            overrides.insert(
                format!("input_player{}_{}_mbtn", player_index, bind_key),
                "nul".to_string(),
            );
        }
    }

    overrides
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn generates_retroarch_tokens() {
        let bindings = json!({
            "1": {
                "a":  { "btn": "4", "axis": "nul" },
                "up": { "btn": "nul", "axis": "-1" },
                "left": { "btn": "nul", "axis": "-0" },
            },
            "2": {
                "b":  { "btn": "4", "axis": "nul" },
            }
        });

        let overrides = overrides_from_bindings(&bindings);

        assert_eq!(overrides.get("input_player1_joypad_index").unwrap(), "0");
        assert_eq!(overrides.get("input_player2_joypad_index").unwrap(), "1");

        assert_eq!(overrides.get("input_player1_a_btn").unwrap(), "4");
        assert_eq!(overrides.get("input_player1_a_axis").unwrap(), "nul");
        assert_eq!(overrides.get("input_player1_a_mbtn").unwrap(), "nul");

        assert_eq!(overrides.get("input_player1_up_axis").unwrap(), "-1");
        assert_eq!(overrides.get("input_player1_up_btn").unwrap(), "nul");
        assert_eq!(overrides.get("input_player1_left_axis").unwrap(), "-0");

        assert_eq!(overrides.get("input_player2_b_btn").unwrap(), "4");
    }

    #[test]
    fn empty_bindings_produce_no_overrides() {
        assert!(overrides_from_bindings(&json!({})).is_empty());
    }
}

pub fn overrides_for_game(game_id: &str) -> HashMap<String, String> {
    match resolve_profile_for_game(game_id) {
        Some(profile) => {
            let bindings = profile
                .get("bindings")
                .cloned()
                .unwrap_or_else(|| json!({}));
            let mut overrides = overrides_from_bindings(&bindings);
            if !overrides.is_empty() {
                overrides.insert("input_joypad_driver".to_string(), "udev".to_string());
            }
            overrides
        }
        None => HashMap::new(),
    }
}
