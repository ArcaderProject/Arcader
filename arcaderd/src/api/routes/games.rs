use axum::body::Bytes;
use axum::extract::{Multipart, Path};
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::{get, post, put};
use axum::Router;
use serde_json::{json, Value};

use crate::api::helpers::{
    error_response, json_response, map_to_value, ok_json, parse_body, serve_file,
};
use crate::daemon::socket::{broadcast_cover_updated, broadcast_games_updated};
use crate::utils::archive::is_archive;
use crate::utils::database::execute;
use crate::utils::emulation::{get_cores_for_extension, get_current_game, start_by_filename, stop};
use crate::utils::games::{
    add_game, delete_game, get_all_games, get_cover_art_path, get_game_by_id, update_game_core,
    update_game_name, upload_cover_art,
};
use crate::utils::imports::{
    cancel_import, complete_extract, complete_install, stash_archive, ImportError,
};
use crate::utils::loader::{download_cover_by_url, get_game_covers, lookup_game_id};

pub fn router() -> Router {
    Router::new()
        .route("/", get(list_games).post(upload_game))
        .route("/import/:token", post(finish_import).delete(discard_import))
        .route("/:id", get(get_game).put(update_name).delete(remove_game))
        .route("/:id/core", put(update_core))
        .route("/:id/cores", get(game_cores))
        .route("/:id/cover", post(upload_cover).get(get_cover))
        .route("/:id/lookup-covers", get(lookup_covers))
        .route("/:id/cover-from-url", post(cover_from_url))
        .route("/:id/start", post(start_game))
        .route("/playing/current", get(playing_current))
        .route("/playing/stop", post(playing_stop))
}

async fn list_games() -> Response {
    let games: Vec<Value> = get_all_games().into_iter().map(map_to_value).collect();
    ok_json(Value::Array(games))
}

async fn get_game(Path(id): Path<String>) -> Response {
    match get_game_by_id(&id) {
        Some(game) => ok_json(map_to_value(game)),
        None => error_response(StatusCode::NOT_FOUND, "Game not found"),
    }
}

async fn upload_game(mut multipart: Multipart) -> Response {
    let mut file_name: Option<String> = None;
    let mut file_buffer: Option<Bytes> = None;
    let mut game_name: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("rom") => {
                file_name = field.file_name().map(|s| s.to_string());
                file_buffer = field.bytes().await.ok();
            }
            Some("name") => {
                game_name = field.text().await.ok();
            }
            _ => {
                let _ = field.bytes().await;
            }
        }
    }

    let (original_filename, buffer) = match (file_name, file_buffer) {
        (Some(name), Some(buf)) => (name, buf),
        _ => return error_response(StatusCode::BAD_REQUEST, "No file uploaded"),
    };

    let game_name = game_name.filter(|s| !s.is_empty());

    if is_archive(&original_filename) {
        return match stash_archive(&original_filename, &buffer) {
            Ok(summary) => json_response(StatusCode::OK, summary),
            Err(message) => {
                eprintln!("Error staging archive: {}", message);
                error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to read archive")
            }
        };
    }

    match add_game(&original_filename, &buffer, game_name) {
        Ok(game) => {
            broadcast_games_updated();
            json_response(StatusCode::CREATED, map_to_value(game))
        }
        Err(message) => {
            eprintln!("Error uploading game: {}", message);
            if message.contains("Unsupported file extension") {
                error_response(StatusCode::BAD_REQUEST, &message)
            } else {
                error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to upload game")
            }
        }
    }
}

async fn finish_import(Path(token): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let mode = body.get("mode").and_then(|v| v.as_str()).unwrap_or("");

    let (result, status) = match mode {
        "extract" => (complete_extract(&token), StatusCode::OK),
        "install" => (complete_install(&token), StatusCode::CREATED),
        _ => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "mode must be \"extract\" or \"install\"",
            )
        }
    };

    match result {
        Ok(value) => {
            broadcast_games_updated();
            json_response(status, value)
        }
        Err(ImportError::NotFound) => {
            error_response(StatusCode::NOT_FOUND, "Import not found or expired")
        }
        Err(ImportError::Message(message)) => {
            eprintln!("Error completing import: {}", message);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to import archive",
            )
        }
    }
}

async fn discard_import(Path(token): Path<String>) -> Response {
    if cancel_import(&token) {
        ok_json(json!({ "message": "Import discarded" }))
    } else {
        error_response(StatusCode::NOT_FOUND, "Import not found or expired")
    }
}

async fn update_name(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let name = body.get("name").and_then(|v| v.as_str());
    let name = match name {
        Some(n) if !n.is_empty() => n,
        _ => return error_response(StatusCode::BAD_REQUEST, "Name is required"),
    };

    if !update_game_name(&id, name) {
        return error_response(StatusCode::NOT_FOUND, "Game not found");
    }

    broadcast_games_updated();

    match get_game_by_id(&id) {
        Some(game) => ok_json(map_to_value(game)),
        None => ok_json(Value::Null),
    }
}

async fn update_core(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let core = body.get("core").and_then(|v| v.as_str());
    let core = match core {
        Some(c) if !c.is_empty() => c,
        _ => return error_response(StatusCode::BAD_REQUEST, "Core is required"),
    };

    if !update_game_core(&id, core) {
        return error_response(StatusCode::NOT_FOUND, "Game not found");
    }

    broadcast_games_updated();

    match get_game_by_id(&id) {
        Some(game) => ok_json(map_to_value(game)),
        None => ok_json(Value::Null),
    }
}

async fn game_cores(Path(id): Path<String>) -> Response {
    let game = match get_game_by_id(&id) {
        Some(g) => g,
        None => return error_response(StatusCode::NOT_FOUND, "Game not found"),
    };

    let extension = game.get("extension").and_then(|v| v.as_str()).unwrap_or("");
    let cores = get_cores_for_extension(extension);
    ok_json(serde_json::to_value(cores).unwrap_or(Value::Array(vec![])))
}

async fn remove_game(Path(id): Path<String>) -> Response {
    if !delete_game(&id) {
        return error_response(StatusCode::NOT_FOUND, "Game not found");
    }
    broadcast_games_updated();
    ok_json(json!({ "message": "Game deleted successfully" }))
}

async fn upload_cover(Path(id): Path<String>, mut multipart: Multipart) -> Response {
    let mut file_buffer: Option<Bytes> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("cover") {
            file_buffer = field.bytes().await.ok();
        } else {
            let _ = field.bytes().await;
        }
    }

    let buffer = match file_buffer {
        Some(buf) => buf,
        None => return error_response(StatusCode::BAD_REQUEST, "No file uploaded"),
    };

    match upload_cover_art(&id, &buffer) {
        Ok(true) => {
            broadcast_cover_updated(&id);
            ok_json(json!({ "message": "Cover art uploaded successfully" }))
        }
        Ok(false) => error_response(StatusCode::NOT_FOUND, "Game not found"),
        Err(message) => {
            eprintln!("Error uploading cover art: {}", message);
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to upload cover art",
            )
        }
    }
}

async fn get_cover(Path(id): Path<String>) -> Response {
    match get_cover_art_path(&id) {
        Some(path) => serve_file(&path),
        None => error_response(StatusCode::NOT_FOUND, "Cover art not found"),
    }
}

async fn lookup_covers(Path(id): Path<String>) -> Response {
    let game = match get_game_by_id(&id) {
        Some(g) => g,
        None => return error_response(StatusCode::NOT_FOUND, "Game not found"),
    };

    let name = game.get("name").and_then(|v| v.as_str()).unwrap_or("");

    let steam_game_id = match lookup_game_id(name).await {
        Ok(Some(id)) => id,
        Ok(None) => {
            return error_response(
                StatusCode::NOT_FOUND,
                "No matching game found on SteamGridDB",
            )
        }
        Err(message) => {
            eprintln!("Error looking up covers: {}", message);
            if message.contains("API key") {
                return error_response(StatusCode::BAD_REQUEST, &message);
            }
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to lookup covers");
        }
    };

    match get_game_covers(&steam_game_id, 10).await {
        Ok(covers) => ok_json(json!({ "steamGameId": steam_game_id, "covers": covers })),
        Err(message) => {
            eprintln!("Error looking up covers: {}", message);
            if message.contains("API key") {
                error_response(StatusCode::BAD_REQUEST, &message)
            } else {
                error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to lookup covers")
            }
        }
    }
}

async fn cover_from_url(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);
    let cover_url = body.get("coverUrl").and_then(|v| v.as_str());
    let cover_url = match cover_url {
        Some(u) if !u.is_empty() => u.to_string(),
        _ => return error_response(StatusCode::BAD_REQUEST, "Cover URL is required"),
    };

    if get_game_by_id(&id).is_none() {
        return error_response(StatusCode::NOT_FOUND, "Game not found");
    }

    let success = download_cover_by_url(&cover_url, &id).await;
    if !success {
        return error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to download cover",
        );
    }

    execute("UPDATE roms SET cover_art = 1 WHERE id = ?", &[&id]);

    broadcast_cover_updated(&id);

    ok_json(json!({ "message": "Cover art updated successfully" }))
}

async fn start_game(Path(id): Path<String>) -> Response {
    let game = match get_game_by_id(&id) {
        Some(g) => g,
        None => return error_response(StatusCode::NOT_FOUND, "Game not found"),
    };

    let filename = game.get("filename").and_then(|v| v.as_str()).unwrap_or("");
    let game_info = json!({
        "id": game.get("id").cloned().unwrap_or(Value::Null),
        "name": game.get("name").cloned().unwrap_or(Value::Null),
        "console": game.get("console").cloned().unwrap_or(Value::Null),
        "filename": game.get("filename").cloned().unwrap_or(Value::Null),
        "core": game.get("core").cloned().unwrap_or(Value::Null),
    });

    let started = start_by_filename(filename, Some(game_info));

    if !started {
        return error_response(StatusCode::CONFLICT, "Emulator already running");
    }

    ok_json(json!({ "message": "Game started successfully", "game": map_to_value(game) }))
}

async fn playing_current() -> Response {
    match get_current_game() {
        None => ok_json(json!({ "playing": false, "game": null })),
        Some(game) => ok_json(json!({ "playing": true, "game": game })),
    }
}

async fn playing_stop() -> Response {
    stop();
    ok_json(json!({ "message": "Game stopped successfully" }))
}
