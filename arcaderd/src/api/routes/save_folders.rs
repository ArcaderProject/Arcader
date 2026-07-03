use axum::body::Bytes;
use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::{delete, get, post};
use axum::Router;
use serde_json::{json, Value};

use crate::api::helpers::{error_response, ok_json, parse_body};
use crate::utils::game_saves::{
    clear_save_folder, create_save_folder, delete_game_saves, delete_save_folder,
    get_all_save_folders, get_games_in_save_folder, lock_save_folder, rename_save_folder,
    set_active_save_folder, unlock_save_folder, SaveFolder,
};
use crate::utils::games::get_game_by_id;

pub fn router() -> Router {
    Router::new()
        .route("/", get(list_folders).post(create_folder))
        .route(
            "/:uuid",
            axum::routing::put(rename_folder).delete(remove_folder),
        )
        .route("/:uuid/activate", post(activate_folder))
        .route("/:uuid/lock", post(lock_folder))
        .route("/:uuid/unlock", post(unlock_folder))
        .route("/:uuid/clear", post(clear_folder))
        .route("/:uuid/games", get(folder_games))
        .route("/:uuid/games/:gameId", delete(remove_game_saves))
}

fn folder_to_value(folder: Option<SaveFolder>) -> Value {
    match folder {
        Some(f) => serde_json::to_value(f).unwrap_or(Value::Null),
        None => Value::Null,
    }
}

async fn list_folders() -> Response {
    let folders = get_all_save_folders();
    ok_json(serde_json::to_value(folders).unwrap_or(Value::Array(vec![])))
}

async fn create_folder(body: Bytes) -> Response {
    let body = parse_body(&body);
    let name = body.get("name").and_then(|v| v.as_str());

    let name = match name {
        Some(n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => return error_response(StatusCode::BAD_REQUEST, "Name is required"),
    };

    let folder = create_save_folder(&name);
    crate::api::helpers::json_response(StatusCode::CREATED, folder_to_value(folder))
}

async fn rename_folder(Path(uuid): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let name = body.get("name").and_then(|v| v.as_str());

    let name = match name {
        Some(n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => return error_response(StatusCode::BAD_REQUEST, "Name is required"),
    };

    match rename_save_folder(&uuid, &name) {
        Ok(folder) => ok_json(folder_to_value(folder)),
        Err(message) => {
            eprintln!("Error updating save folder: {}", message);
            if message == "Cannot rename global profile" {
                return error_response(StatusCode::FORBIDDEN, &message);
            }
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to update save folder",
            )
        }
    }
}

async fn activate_folder(Path(uuid): Path<String>) -> Response {
    match set_active_save_folder(&uuid) {
        Ok(folder) => ok_json(folder_to_value(folder)),
        Err(message) => {
            eprintln!("Error activating save folder: {}", message);
            if message == "Save folder not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to activate save folder",
            )
        }
    }
}

async fn lock_folder(Path(uuid): Path<String>) -> Response {
    let folder = lock_save_folder(&uuid);
    ok_json(folder_to_value(folder))
}

async fn unlock_folder(Path(uuid): Path<String>) -> Response {
    let folder = unlock_save_folder(&uuid);
    ok_json(folder_to_value(folder))
}

async fn clear_folder(Path(uuid): Path<String>) -> Response {
    match clear_save_folder(&uuid) {
        Ok(result) => ok_json(json!({ "success": true, "deletedCount": result.deleted_count })),
        Err(message) => {
            eprintln!("Error clearing save folder: {}", message);
            if message == "Save folder not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            if message == "Cannot clear a locked save folder" {
                return error_response(StatusCode::FORBIDDEN, &message);
            }
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to clear save folder",
            )
        }
    }
}

async fn remove_folder(Path(uuid): Path<String>) -> Response {
    match delete_save_folder(&uuid) {
        Ok(()) => ok_json(json!({ "success": true })),
        Err(message) => {
            eprintln!("Error deleting save folder: {}", message);
            if message == "Cannot delete global profile" {
                return error_response(StatusCode::FORBIDDEN, &message);
            }
            if message == "Save folder not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete save folder",
            )
        }
    }
}

async fn folder_games(Path(uuid): Path<String>) -> Response {
    match get_games_in_save_folder(&uuid) {
        Ok(games_in_folder) => {
            let enriched: Vec<Value> = games_in_folder
                .into_iter()
                .filter_map(|game_save| {
                    get_game_by_id(&game_save.game_id).map(|game| {
                        json!({
                            "gameId": game_save.game_id,
                            "fileCount": game_save.file_count,
                            "totalSize": game_save.total_size,
                            "game": Value::Object(game),
                        })
                    })
                })
                .collect();
            ok_json(Value::Array(enriched))
        }
        Err(message) => {
            eprintln!("Error fetching games in save folder: {}", message);
            if message == "Save folder not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to fetch games in save folder",
            )
        }
    }
}

async fn remove_game_saves(Path((uuid, game_id)): Path<(String, String)>) -> Response {
    match delete_game_saves(&uuid, &game_id) {
        Ok(result) => ok_json(json!({
            "success": true,
            "deletedCount": result.deleted_count,
            "freedSpace": result.freed_space,
        })),
        Err(message) => {
            eprintln!("Error deleting game saves: {}", message);
            if message == "Save folder not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            if message == "Cannot delete saves from a locked save folder" {
                return error_response(StatusCode::FORBIDDEN, &message);
            }
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete game saves",
            )
        }
    }
}
