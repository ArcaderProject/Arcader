use axum::body::Bytes;
use axum::extract::{Multipart, Path};
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::{get, post};
use axum::Router;
use serde_json::{json, Value};

use crate::api::helpers::{error_response, json_response, ok_json, parse_body, serve_file};
use crate::daemon::socket::broadcast_apps_updated;
use crate::utils::apps::{
    add_app, delete_app, get_all_apps, get_app_by_id, get_app_icon_path, reorder_apps, to_client_json,
    update_app, upload_app_icon,
};

pub fn router() -> Router {
    Router::new()
        .route("/", get(list_apps).post(create_app))
        .route("/reorder", post(reorder))
        .route("/:id", get(get_app).put(update).delete(remove_app))
        .route("/:id/icon", post(upload_icon).put(upload_icon).get(get_icon))
        .route("/:id/launch", post(launch))
}

async fn list_apps() -> Response {
    let apps: Vec<Value> = get_all_apps().iter().map(to_client_json).collect();
    ok_json(Value::Array(apps))
}

async fn get_app(Path(id): Path<String>) -> Response {
    match get_app_by_id(&id) {
        Some(app) => ok_json(to_client_json(&app)),
        None => error_response(StatusCode::NOT_FOUND, "App not found"),
    }
}

async fn create_app(body: Bytes) -> Response {
    let body = parse_body(&body);

    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let app_type = body.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let url = body.get("url").and_then(|v| v.as_str());
    let user_agent = body.get("userAgent").and_then(|v| v.as_str());
    let exec = body.get("exec").and_then(|v| v.as_str());
    let args: Vec<String> = body
        .get("args")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    match add_app(name, app_type, url, user_agent, exec, &args) {
        Ok(app) => {
            broadcast_apps_updated();
            json_response(StatusCode::CREATED, to_client_json(&app))
        }
        Err(message) => error_response(StatusCode::BAD_REQUEST, &message),
    }
}

async fn update(Path(id): Path<String>, body: Bytes) -> Response {
    let body = parse_body(&body);

    match update_app(&id, &body) {
        Ok(true) => {
            broadcast_apps_updated();
            match get_app_by_id(&id) {
                Some(app) => ok_json(to_client_json(&app)),
                None => ok_json(Value::Null),
            }
        }
        Ok(false) => error_response(StatusCode::NOT_FOUND, "App not found"),
        Err(message) => error_response(StatusCode::BAD_REQUEST, &message),
    }
}

async fn remove_app(Path(id): Path<String>) -> Response {
    if !delete_app(&id) {
        return error_response(StatusCode::NOT_FOUND, "App not found");
    }
    broadcast_apps_updated();
    ok_json(json!({ "message": "App deleted successfully" }))
}

async fn reorder(body: Bytes) -> Response {
    let body = parse_body(&body);
    let order: Vec<String> = match body.get("order").and_then(|v| v.as_array()) {
        Some(arr) => arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect(),
        None => return error_response(StatusCode::BAD_REQUEST, "order array is required"),
    };

    reorder_apps(&order);
    broadcast_apps_updated();
    ok_json(json!({ "message": "Apps reordered successfully" }))
}

async fn upload_icon(Path(id): Path<String>, mut multipart: Multipart) -> Response {
    let mut file_buffer: Option<Bytes> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("icon") {
            file_buffer = field.bytes().await.ok();
        } else {
            let _ = field.bytes().await;
        }
    }

    let buffer = match file_buffer {
        Some(buf) => buf,
        None => return error_response(StatusCode::BAD_REQUEST, "No file uploaded"),
    };

    match upload_app_icon(&id, &buffer) {
        Ok(true) => {
            broadcast_apps_updated();
            ok_json(json!({ "message": "Icon uploaded successfully" }))
        }
        Ok(false) => error_response(StatusCode::NOT_FOUND, "App not found"),
        Err(message) => {
            eprintln!("Error uploading app icon: {}", message);
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "Failed to upload icon")
        }
    }
}

async fn get_icon(Path(id): Path<String>) -> Response {
    match get_app_icon_path(&id) {
        Some(path) => serve_file(&path),
        None => error_response(StatusCode::NOT_FOUND, "Icon not found"),
    }
}

async fn launch(Path(id): Path<String>) -> Response {
    let app = match get_app_by_id(&id) {
        Some(a) => a,
        None => return error_response(StatusCode::NOT_FOUND, "App not found"),
    };

    match crate::utils::emulation::launch_app(&to_client_json(&app)) {
        Ok(()) => ok_json(json!({ "message": "App launched successfully" })),
        Err(message) => error_response(StatusCode::CONFLICT, &message),
    }
}
