use axum::body::Bytes;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Map, Value};

pub fn json_response(status: StatusCode, value: Value) -> Response {
    (status, Json(value)).into_response()
}

pub fn ok_json(value: Value) -> Response {
    json_response(StatusCode::OK, value)
}

pub fn error_response(status: StatusCode, message: &str) -> Response {
    json_response(status, json!({ "error": message }))
}

pub fn parse_body(bytes: &Bytes) -> Value {
    if bytes.is_empty() {
        return Value::Null;
    }
    serde_json::from_slice(bytes).unwrap_or(Value::Null)
}

pub fn map_to_value(map: Map<String, Value>) -> Value {
    Value::Object(map)
}

pub fn serve_file(path: &std::path::Path) -> Response {
    match std::fs::read(path) {
        Ok(bytes) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, mime.as_ref().to_string())],
                bytes,
            )
                .into_response()
        }
        Err(_) => error_response(StatusCode::NOT_FOUND, "File not found"),
    }
}
