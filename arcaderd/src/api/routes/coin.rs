use axum::body::Bytes;
use axum::response::Response;
use axum::routing::{get, post};
use axum::Router;
use serde_json::Value;

use crate::api::helpers::{ok_json, parse_body};
use crate::coin::{
    broadcast_coin_status, coin_slot_enabled, coin_status_value, credits, seconds_per_coin,
    time_mode_enabled, timebank,
};

async fn status() -> Response {
    let mut data = coin_status_value();
    if let Value::Object(ref mut map) = data {
        map.insert(
            "coinSlotEnabled".to_string(),
            Value::Bool(coin_slot_enabled()),
        );
    }
    ok_json(data)
}

async fn add(body: Bytes) -> Response {
    let payload = parse_body(&body);

    if let Some(seconds) = payload.get("seconds").and_then(|v| v.as_i64()) {
        timebank::add_seconds(seconds);
    } else if let Some(credits) = payload.get("credits").and_then(|v| v.as_u64()) {
        credits::add(credits as u32);
    } else if time_mode_enabled() {
        timebank::add_seconds(seconds_per_coin());
    } else {
        credits::add(1);
    }

    broadcast_coin_status();
    status().await
}

pub fn router() -> Router {
    Router::new()
        .route("/status", get(status))
        .route("/add", post(add))
}
