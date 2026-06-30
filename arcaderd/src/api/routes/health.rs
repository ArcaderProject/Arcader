use axum::routing::any;
use axum::Router;

use crate::api::helpers::ok_json;
use axum::response::Response;
use serde_json::json;

async fn health() -> Response {
    ok_json(json!({ "status": "ok" }))
}

pub fn router() -> Router {
    Router::new().route("/", any(health))
}
