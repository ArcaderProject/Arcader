use axum::response::Response;
use axum::routing::get;
use axum::Router;
use serde_json::Value;

use crate::api::helpers::ok_json;
use crate::coin::{coin_slot_enabled, coin_status_value};

async fn status() -> Response {
    let mut data = coin_status_value();
    if let Value::Object(ref mut map) = data {
        map.insert("coinSlotEnabled".to_string(), Value::Bool(coin_slot_enabled()));
    }
    ok_json(data)
}

pub fn router() -> Router {
    Router::new().route("/status", get(status))
}
