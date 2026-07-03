use axum::body::Bytes;
use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::{get, post};
use axum::Router;
use serde_json::{json, Value};

use crate::api::helpers::{error_response, json_response, ok_json, parse_body};
use crate::controller::session;
use crate::daemon::socket::broadcast_games_updated;
use crate::utils::controller_profiles::{
    create_profile, delete_profile, get_profile, get_profile_game_ids, list_profiles,
    rename_profile, set_profile_games, RETROPAD_BINDS,
};

pub fn router() -> Router {
    Router::new()
        .route("/", get(list_all).post(create))
        .route("/binds", get(list_binds))
        .route("/config-status", get(config_status))
        .route("/:id", get(get_one).put(rename).delete(remove))
        .route("/:id/games", get(get_games).put(set_games))
        .route("/:id/configure", post(configure))
        .route("/:id/cancel", post(cancel_configure))
}

async fn list_all() -> Response {
    ok_json(Value::Array(list_profiles()))
}

async fn list_binds() -> Response {
    let binds: Vec<Value> = RETROPAD_BINDS
        .iter()
        .map(|(key, label)| json!({ "input": key, "label": label }))
        .collect();
    ok_json(Value::Array(binds))
}

async fn get_one(Path(id): Path<String>) -> Response {
    match get_profile(&id) {
        Some(profile) => ok_json(profile),
        None => error_response(StatusCode::NOT_FOUND, "Profile not found"),
    }
}

async fn create(body: Bytes) -> Response {
    let body = parse_body(&body);
    let name = body.get("name").and_then(|v| v.as_str());
    let name = match name {
        Some(n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => return error_response(StatusCode::BAD_REQUEST, "Name is required"),
    };

    match create_profile(&name) {
        Ok(profile) => json_response(StatusCode::CREATED, profile),
        Err(message) => {
            if message.contains("already exists") {
                return error_response(StatusCode::BAD_REQUEST, &message);
            }
            eprintln!("Error creating controller profile: {}", message);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to create profile",
            )
        }
    }
}

async fn rename(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let name = body.get("name").and_then(|v| v.as_str());
    let name = match name {
        Some(n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => return error_response(StatusCode::BAD_REQUEST, "Name is required"),
    };

    match rename_profile(&id, &name) {
        Ok(profile) => ok_json(profile),
        Err(message) => {
            if message == "Profile not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            if message.contains("already exists") || message.contains("Cannot rename") {
                return error_response(StatusCode::BAD_REQUEST, &message);
            }
            eprintln!("Error renaming controller profile: {}", message);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to rename profile",
            )
        }
    }
}

async fn remove(Path(id): Path<String>) -> Response {
    match delete_profile(&id) {
        Ok(()) => {
            broadcast_games_updated();
            ok_json(json!({ "message": "Profile deleted successfully" }))
        }
        Err(message) => {
            if message == "Profile not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            if message.contains("Cannot delete") {
                return error_response(StatusCode::FORBIDDEN, &message);
            }
            eprintln!("Error deleting controller profile: {}", message);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete profile",
            )
        }
    }
}

async fn get_games(Path(id): Path<String>) -> Response {
    if get_profile(&id).is_none() {
        return error_response(StatusCode::NOT_FOUND, "Profile not found");
    }
    let game_ids: Vec<Value> = get_profile_game_ids(&id)
        .into_iter()
        .map(Value::from)
        .collect();
    ok_json(json!({ "gameIds": game_ids }))
}

async fn set_games(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let game_ids: Vec<String> = match body.get("gameIds").and_then(|v| v.as_array()) {
        Some(arr) => arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        None => return error_response(StatusCode::BAD_REQUEST, "gameIds must be an array"),
    };

    match set_profile_games(&id, &game_ids) {
        Ok(count) => ok_json(json!({ "message": "Games updated successfully", "count": count })),
        Err(message) => {
            if message == "Profile not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            eprintln!("Error updating profile games: {}", message);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to update games")
        }
    }
}

async fn config_status() -> Response {
    ok_json(json!({
        "active": session::is_active(),
        "profileId": session::active_profile_id(),
    }))
}

async fn configure(Path(id): Path<String>) -> Response {
    match session::start(&id) {
        Ok(()) => ok_json(json!({ "started": true })),
        Err(message) => {
            if message == "Profile not found" {
                return error_response(StatusCode::NOT_FOUND, &message);
            }
            error_response(StatusCode::CONFLICT, &message)
        }
    }
}

async fn cancel_configure(Path(_id): Path<String>) -> Response {
    session::cancel();
    ok_json(json!({ "cancelled": true }))
}
