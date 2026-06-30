pub mod helpers;
pub mod routes;

use std::path::PathBuf;

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Request};
use axum::http::{header, HeaderValue, StatusCode, Uri};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::Router;
use serde_json::json;

use crate::api::helpers::{error_response, ok_json, parse_body, serve_file};
use crate::utils::config::get_config;
use crate::utils::paths::cwd;

const SERVER_PORT: u16 = 5328;

fn dashboard_path() -> PathBuf {
    match std::env::var("ARCADER_DASHBOARD_PATH") {
        Ok(p) if !p.is_empty() => PathBuf::from(p),
        _ => cwd().join("dashboard"),
    }
}

async fn ignore_cors(req: Request, next: Next) -> Response {
    let mut res = next.run(req).await;
    let headers = res.headers_mut();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, DELETE"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Content-Type, Authorization"),
    );
    res
}

async fn authenticate_request(req: Request, next: Next) -> Response {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let current_password = get_config("admin.password", None);

    let expected = current_password.map(|p| format!("Bearer {}", p));

    match (auth_header, expected) {
        (Some(auth), Some(expected)) if auth == expected => next.run(req).await,
        _ => error_response(StatusCode::UNAUTHORIZED, "Unauthorized"),
    }
}

async fn login(body: Bytes) -> Response {
    let body = parse_body(&body);
    let current_password = get_config("admin.password", None);

    let provided = body.get("password").and_then(|v| v.as_str());

    match (provided, current_password.as_deref()) {
        (Some(p), Some(c)) if p == c => ok_json(json!({ "token": c })),
        _ => error_response(StatusCode::UNAUTHORIZED, "Invalid password"),
    }
}

async fn spa_fallback(uri: Uri) -> Response {
    let dashboard = dashboard_path();
    let rel = uri.path().trim_start_matches('/');

    if !rel.is_empty() {
        let candidate = dashboard.join(rel);
        if candidate.is_file() {
            return serve_file(&candidate);
        }
    }

    let index_path = dashboard.join("index.html");
    if index_path.is_file() {
        return serve_file(&index_path);
    }

    (
        StatusCode::NOT_FOUND,
        "Dashboard not found. Please ensure dashboard files are in the working directory.",
    )
        .into_response()
}

fn build_app() -> Router {
    let protected = Router::new()
        .nest("/games", routes::games::router())
        .nest("/lists", routes::game_lists::router())
        .nest("/config", routes::config::router())
        .nest("/coin", routes::coin::router())
        .nest("/save-folders", routes::save_folders::router())
        .layer(middleware::from_fn(authenticate_request));

    let api_router = Router::new()
        .route("/login", post(login))
        .nest("/health", routes::health::router())
        .merge(protected);

    Router::new()
        .nest("/api", api_router)
        .fallback(spa_fallback)
        .layer(DefaultBodyLimit::disable())
        .layer(middleware::from_fn(ignore_cors))
}

pub async fn start_server() {
    let app = build_app();

    let addr = format!("0.0.0.0:{}", SERVER_PORT);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind server port");

    println!("Server started on port {}", SERVER_PORT);

    axum::serve(listener, app).await.expect("Server error");
}
