use axum::body::Bytes;
use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use rand::RngCore;
use serde_json::{json, Value};

use crate::api::helpers::{error_response, json_response, map_to_value, ok_json, parse_body};
use crate::utils::config::{get_config, set_config};
use crate::utils::database::{execute, query_json, query_one_json, try_execute};

const CONFIG_KEY: &str = "selected_list_id";

pub fn router() -> Router {
    Router::new()
        .route("/", get(list_all).post(create_list))
        .route("/selected", get(get_selected).post(set_selected))
        .route("/:id", axum::routing::put(update_list).delete(delete_list))
        .route("/:id/games", get(get_list_games).put(set_list_games))
}

fn random_hex_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let mut s = String::with_capacity(32);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn is_default(row: &serde_json::Map<String, Value>) -> bool {
    row.get("is_default")
        .and_then(|v| v.as_i64())
        .map(|n| n != 0)
        .unwrap_or(false)
}

async fn list_all() -> Response {
    let lists = query_json(
        "\n            SELECT gl.*,\n                   (SELECT COUNT(*) FROM game_list_items WHERE list_id = gl.id) as item_count\n            FROM game_lists gl\n            ORDER BY is_default DESC, name\n        ",
        &[],
    );
    let lists: Vec<Value> = lists.into_iter().map(map_to_value).collect();
    ok_json(Value::Array(lists))
}

async fn get_selected() -> Response {
    let selected_list_id = get_config(CONFIG_KEY, Some("default")).unwrap_or_default();

    match query_one_json("SELECT * FROM game_lists WHERE id = ?", &[&selected_list_id]) {
        Some(list) => ok_json(map_to_value(list)),
        None => error_response(StatusCode::NOT_FOUND, "Selected list not found"),
    }
}

async fn set_selected(body: Bytes) -> Response {
    let body = parse_body(&body);
    let list_id = body.get("listId").and_then(|v| v.as_str());
    let list_id = match list_id {
        Some(id) if !id.is_empty() => id.to_string(),
        _ => return error_response(StatusCode::BAD_REQUEST, "List ID is required"),
    };

    let list = match query_one_json("SELECT * FROM game_lists WHERE id = ?", &[&list_id]) {
        Some(l) => l,
        None => return error_response(StatusCode::NOT_FOUND, "List not found"),
    };

    set_config(CONFIG_KEY, &list_id);

    ok_json(json!({ "message": "Selected list updated successfully", "list": map_to_value(list) }))
}

async fn create_list(body: Bytes) -> Response {
    let body = parse_body(&body);
    let name = body.get("name").and_then(|v| v.as_str());
    let list_type = body.get("type").and_then(|v| v.as_str());

    let (name, list_type) = match (name, list_type) {
        (Some(n), Some(t)) if !n.is_empty() && !t.is_empty() => (n, t),
        _ => return error_response(StatusCode::BAD_REQUEST, "Name and type are required"),
    };

    if list_type != "include" && list_type != "exclude" {
        return error_response(StatusCode::BAD_REQUEST, "Type must be 'include' or 'exclude'");
    }

    let id = random_hex_id();

    match try_execute(
        "\n            INSERT INTO game_lists (id, name, type, is_default)\n            VALUES (?, ?, ?, 0)\n        ",
        &[&id, &name, &list_type],
    ) {
        Ok(_) => {}
        Err(message) => {
            if message.contains("UNIQUE constraint failed") {
                return error_response(StatusCode::BAD_REQUEST, "A list with this name already exists");
            }
            eprintln!("Error creating game list: {}", message);
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to create game list");
        }
    }

    let new_list = query_one_json("SELECT * FROM game_lists WHERE id = ?", &[&id]);
    json_response(
        StatusCode::CREATED,
        new_list.map(map_to_value).unwrap_or(Value::Null),
    )
}

async fn update_list(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let name = body.get("name").and_then(|v| v.as_str());
    let name = match name {
        Some(n) if !n.is_empty() => n,
        _ => return error_response(StatusCode::BAD_REQUEST, "Name is required"),
    };

    let list = match query_one_json("SELECT is_default FROM game_lists WHERE id = ?", &[&id]) {
        Some(l) => l,
        None => return error_response(StatusCode::NOT_FOUND, "List not found"),
    };
    if is_default(&list) {
        return error_response(StatusCode::FORBIDDEN, "Cannot edit the default list");
    }

    match try_execute("UPDATE game_lists SET name = ? WHERE id = ?", &[&name, &id]) {
        Ok(_) => {}
        Err(message) => {
            if message.contains("UNIQUE constraint failed") {
                return error_response(StatusCode::BAD_REQUEST, "A list with this name already exists");
            }
            eprintln!("Error updating game list: {}", message);
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update game list");
        }
    }

    let updated_list = query_one_json("SELECT * FROM game_lists WHERE id = ?", &[&id]);
    ok_json(updated_list.map(map_to_value).unwrap_or(Value::Null))
}

async fn delete_list(Path(id): Path<String>) -> Response {
    let list = match query_one_json("SELECT is_default FROM game_lists WHERE id = ?", &[&id]) {
        Some(l) => l,
        None => return error_response(StatusCode::NOT_FOUND, "List not found"),
    };
    if is_default(&list) {
        return error_response(StatusCode::FORBIDDEN, "Cannot delete the default list");
    }

    let selected_list_id = get_config(CONFIG_KEY, Some("default")).unwrap_or_default();
    if selected_list_id == id {
        set_config(CONFIG_KEY, "default");
    }

    execute("DELETE FROM game_lists WHERE id = ?", &[&id]);

    ok_json(json!({ "message": "List deleted successfully" }))
}

async fn get_list_games(Path(id): Path<String>) -> Response {
    let list = match query_one_json("SELECT * FROM game_lists WHERE id = ?", &[&id]) {
        Some(l) => l,
        None => return error_response(StatusCode::NOT_FOUND, "List not found"),
    };

    let items = query_json("SELECT game_id FROM game_list_items WHERE list_id = ?", &[&id]);
    let game_ids: Vec<Value> = items
        .iter()
        .map(|item| item.get("game_id").cloned().unwrap_or(Value::Null))
        .collect();

    ok_json(json!({
        "gameIds": game_ids,
        "type": list.get("type").cloned().unwrap_or(Value::Null),
    }))
}

async fn set_list_games(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let game_ids = match body.get("gameIds").and_then(|v| v.as_array()) {
        Some(arr) => arr.clone(),
        None => return error_response(StatusCode::BAD_REQUEST, "gameIds must be an array"),
    };

    let list = match query_one_json("SELECT is_default FROM game_lists WHERE id = ?", &[&id]) {
        Some(l) => l,
        None => return error_response(StatusCode::NOT_FOUND, "List not found"),
    };
    if is_default(&list) {
        return error_response(StatusCode::FORBIDDEN, "Cannot edit games in the default list");
    }

    execute("DELETE FROM game_list_items WHERE list_id = ?", &[&id]);

    for game_id in &game_ids {
        if let Some(gid) = game_id.as_str() {
            execute(
                "INSERT INTO game_list_items (list_id, game_id)\n                                           VALUES (?, ?)",
                &[&id, &gid],
            );
        }
    }

    ok_json(json!({ "message": "Games updated successfully", "count": game_ids.len() }))
}
