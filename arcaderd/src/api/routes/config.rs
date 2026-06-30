use axum::body::Bytes;
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::{get, put};
use axum::Router;
use serde_json::{json, Map, Value};

use crate::api::helpers::{error_response, ok_json, parse_body};
use crate::utils::config::{get_config, set_config};

const UI_CONFIG_KEYS: [&str; 5] = [
    "coinScreen.insertMessage",
    "coinScreen.infoMessage",
    "coinScreen.konamiCodeEnabled",
    "coinScreen.coinSlotEnabled",
    "steamGridDbApiKey",
];

pub fn router() -> Router {
    Router::new()
        .route("/", get(get_config_handler).put(update_config))
        .route("/password", put(update_password))
}

async fn get_config_handler() -> Response {
    let mut config = Map::new();

    for key in UI_CONFIG_KEYS {
        let value = get_config(key, None);

        let entry = match value.as_deref() {
            Some("true") => Value::Bool(true),
            Some("false") => Value::Bool(false),
            Some(other) => Value::from(other),
            None => Value::Null,
        };
        config.insert(key.to_string(), entry);
    }

    ok_json(Value::Object(config))
}

async fn update_config(body: Bytes) -> Response {
    let updates = parse_body(&body);

    let obj = match updates.as_object() {
        Some(o) => o,
        None => return error_response(StatusCode::BAD_REQUEST, "Invalid config data"),
    };

    for (key, value) in obj {
        if UI_CONFIG_KEYS.contains(&key.as_str()) {
            let string_value = match value {
                Value::Bool(b) => b.to_string(),
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            set_config(key, &string_value);
        } else {
            return error_response(
                StatusCode::FORBIDDEN,
                &format!("Config key '{}' is not accessible to UI", key),
            );
        }
    }

    ok_json(json!({ "success": true }))
}

async fn update_password(body: Bytes) -> Response {
    let body = parse_body(&body);
    let new_password = body.get("newPassword").and_then(|v| v.as_str());

    let password = match new_password {
        Some(p) if !p.trim().is_empty() => p.trim().to_string(),
        _ => return error_response(StatusCode::BAD_REQUEST, "Invalid password"),
    };

    set_config("admin.password", &password);

    ok_json(json!({ "success": true, "token": password }))
}
