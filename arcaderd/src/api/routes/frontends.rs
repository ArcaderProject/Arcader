use axum::body::Bytes;
use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::{get, post};
use axum::Router;
use serde_json::{json, Value};

use crate::api::helpers::{error_response, map_to_value, ok_json, parse_body};
use crate::utils::frontends;

pub fn router() -> Router {
    Router::new()
        .route("/", get(list).post(add))
        .route("/:id", axum::routing::delete(remove))
        .route("/:id/activate", post(activate))
        .route("/:id/update", post(update))
        .route("/:id/check-update", post(check_update))
}

async fn list() -> Response {
    let frontends: Vec<Value> = frontends::get_all().into_iter().map(map_to_value).collect();
    ok_json(Value::Array(frontends))
}

async fn add(body: Bytes) -> Response {
    let body = parse_body(&body);
    let url = match body.get("url").and_then(|v| v.as_str()) {
        Some(u) if !u.is_empty() => u.to_string(),
        _ => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "A GitHub repository url is required",
            )
        }
    };

    match frontends::add_and_install(&url).await {
        Ok(id) => match frontends::get_by_id(&id) {
            Some(f) => crate::api::helpers::json_response(StatusCode::CREATED, map_to_value(f)),
            None => ok_json(json!({ "id": id })),
        },
        Err(message) => error_response(StatusCode::BAD_REQUEST, &message),
    }
}

async fn activate(Path(id): Path<String>) -> Response {
    match frontends::set_active(&id) {
        Ok(()) => ok_json(json!({ "message": "Frontend activated", "active": id })),
        Err(message) => error_response(StatusCode::BAD_REQUEST, &message),
    }
}

async fn update(Path(id): Path<String>) -> Response {
    match frontends::install(&id).await {
        Ok(version) => {
            frontends::restart();
            ok_json(json!({ "message": "Frontend updated", "installedVersion": version }))
        }
        Err(message) => error_response(StatusCode::BAD_REQUEST, &message),
    }
}

async fn check_update(Path(id): Path<String>) -> Response {
    match frontends::check_update(&id).await {
        Ok(status) => ok_json(status),
        Err(message) => error_response(StatusCode::BAD_REQUEST, &message),
    }
}

async fn remove(Path(id): Path<String>) -> Response {
    match frontends::remove(&id) {
        Ok(()) => ok_json(json!({ "message": "Frontend removed" })),
        Err(message) => error_response(StatusCode::BAD_REQUEST, &message),
    }
}
