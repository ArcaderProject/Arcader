use std::fs;
use std::path::PathBuf;

use serde_json::{json, Map, Value};

use crate::utils::database::{execute, query_json, query_one_json};
use crate::utils::ids::random_hex_id;
use crate::utils::paths::cwd;

fn app_icon_path(app_id: &str) -> PathBuf {
    cwd()
        .join("data")
        .join("app_icons")
        .join(format!("{}.png", app_id))
}

fn format_app(mut row: Map<String, Value>) -> Map<String, Value> {
    let args = row
        .get("args")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .filter(|v| v.is_array())
        .unwrap_or_else(|| Value::Array(vec![]));
    row.insert("args".to_string(), args);

    let icon = row.get("icon").and_then(|v| v.as_i64()).unwrap_or(0) != 0;
    row.insert("icon".to_string(), Value::Bool(icon));

    let enabled = row.get("enabled").and_then(|v| v.as_i64()).unwrap_or(0) != 0;
    row.insert("enabled".to_string(), Value::Bool(enabled));

    row
}

pub fn get_all_apps() -> Vec<Map<String, Value>> {
    query_json("SELECT * FROM apps ORDER BY position ASC, name ASC", &[])
        .into_iter()
        .map(format_app)
        .collect()
}

pub fn get_enabled_apps() -> Vec<Map<String, Value>> {
    query_json(
        "SELECT * FROM apps WHERE enabled = 1 ORDER BY position ASC, name ASC",
        &[],
    )
    .into_iter()
    .map(format_app)
    .collect()
}

pub fn get_app_by_id(app_id: &str) -> Option<Map<String, Value>> {
    query_one_json("SELECT * FROM apps WHERE id = ?", &[&app_id]).map(format_app)
}

fn next_position() -> i64 {
    query_one_json(
        "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM apps",
        &[],
    )
    .and_then(|row| row.get("next").and_then(|v| v.as_i64()))
    .unwrap_or(0)
}

pub fn add_app(
    name: &str,
    app_type: &str,
    url: Option<&str>,
    user_agent: Option<&str>,
    exec: Option<&str>,
    args: &[String],
) -> Result<Map<String, Value>, String> {
    if name.trim().is_empty() {
        return Err("Name is required".to_string());
    }
    match app_type {
        "web" => {
            if url.map(|u| u.trim().is_empty()).unwrap_or(true) {
                return Err("Web apps require a url".to_string());
            }
        }
        "native" => {
            if exec.map(|e| e.trim().is_empty()).unwrap_or(true) {
                return Err("Native apps require an exec".to_string());
            }
        }
        other => return Err(format!("Unknown app type: {}", other)),
    }

    let app_id = random_hex_id();
    let args_json = serde_json::to_string(args).unwrap_or_else(|_| "[]".to_string());
    let position = next_position();

    execute(
        "INSERT INTO apps (id, name, type, url, user_agent, exec, args, position) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        &[
            &app_id,
            &name,
            &app_type,
            &url,
            &user_agent,
            &exec,
            &args_json,
            &position,
        ],
    );

    get_app_by_id(&app_id).ok_or_else(|| "Failed to read back created app".to_string())
}

pub fn update_app(app_id: &str, body: &Value) -> Result<bool, String> {
    if get_app_by_id(app_id).is_none() {
        return Ok(false);
    }

    if let Some(t) = body.get("type").and_then(|v| v.as_str()) {
        if t != "web" && t != "native" {
            return Err(format!("Unknown app type: {}", t));
        }
    }

    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = body.get("name").and_then(|v| v.as_str()) {
        sets.push("name = ?".to_string());
        values.push(Box::new(v.to_string()));
    }
    if let Some(v) = body.get("type").and_then(|v| v.as_str()) {
        sets.push("type = ?".to_string());
        values.push(Box::new(v.to_string()));
    }
    if let Some(field) = body.get("url") {
        sets.push("url = ?".to_string());
        values.push(Box::new(field.as_str().map(|s| s.to_string())));
    }
    if let Some(field) = body.get("userAgent") {
        sets.push("user_agent = ?".to_string());
        values.push(Box::new(field.as_str().map(|s| s.to_string())));
    }
    if let Some(field) = body.get("exec") {
        sets.push("exec = ?".to_string());
        values.push(Box::new(field.as_str().map(|s| s.to_string())));
    }
    if let Some(field) = body.get("args").and_then(|v| v.as_array()) {
        let args: Vec<String> = field
            .iter()
            .filter_map(|a| a.as_str().map(|s| s.to_string()))
            .collect();
        sets.push("args = ?".to_string());
        values.push(Box::new(
            serde_json::to_string(&args).unwrap_or_else(|_| "[]".to_string()),
        ));
    }
    if let Some(field) = body.get("enabled").and_then(|v| v.as_bool()) {
        sets.push("enabled = ?".to_string());
        values.push(Box::new(if field { 1i64 } else { 0i64 }));
    }

    if sets.is_empty() {
        return Ok(true);
    }

    values.push(Box::new(app_id.to_string()));
    let sql = format!("UPDATE apps SET {} WHERE id = ?", sets.join(", "));
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|b| b.as_ref()).collect();

    Ok(execute(&sql, &params) > 0)
}

pub fn delete_app(app_id: &str) -> bool {
    let icon = app_icon_path(app_id);
    if icon.exists() {
        let _ = fs::remove_file(icon);
    }
    execute("DELETE FROM apps WHERE id = ?", &[&app_id]) > 0
}

pub fn reorder_apps(order: &[String]) {
    for (index, app_id) in order.iter().enumerate() {
        execute(
            "UPDATE apps SET position = ? WHERE id = ?",
            &[&(index as i64), app_id],
        );
    }
}

pub fn upload_app_icon(app_id: &str, image_buffer: &[u8]) -> Result<bool, String> {
    if get_app_by_id(app_id).is_none() {
        return Ok(false);
    }
    fs::write(app_icon_path(app_id), image_buffer).map_err(|e| e.to_string())?;
    Ok(execute("UPDATE apps SET icon = 1 WHERE id = ?", &[&app_id]) > 0)
}

pub fn get_app_icon_path(app_id: &str) -> Option<PathBuf> {
    let app = get_app_by_id(app_id)?;
    let has_icon = app.get("icon").and_then(|v| v.as_bool()).unwrap_or(false);
    if !has_icon {
        return None;
    }
    let path = app_icon_path(app_id);
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

pub fn get_app_icon_base64(app_id: &str) -> Option<String> {
    let path = get_app_icon_path(app_id)?;
    match fs::read(&path) {
        Ok(buffer) => {
            use base64::Engine;
            Some(base64::engine::general_purpose::STANDARD.encode(buffer))
        }
        Err(e) => {
            eprintln!("Error reading icon for app {}: {}", app_id, e);
            None
        }
    }
}

pub fn to_client_json(app: &Map<String, Value>) -> Value {
    json!({
        "id": app.get("id").cloned().unwrap_or(Value::Null),
        "name": app.get("name").cloned().unwrap_or(Value::Null),
        "type": app.get("type").cloned().unwrap_or(Value::Null),
        "url": app.get("url").cloned().unwrap_or(Value::Null),
        "userAgent": app.get("user_agent").cloned().unwrap_or(Value::Null),
        "exec": app.get("exec").cloned().unwrap_or(Value::Null),
        "args": app.get("args").cloned().unwrap_or(Value::Array(vec![])),
        "icon": app.get("icon").cloned().unwrap_or(Value::Bool(false)),
        "enabled": app.get("enabled").cloned().unwrap_or(Value::Bool(false)),
        "position": app.get("position").cloned().unwrap_or(Value::Null),
    })
}
