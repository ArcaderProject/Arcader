use std::io::{Read, Write};
use std::process::Stdio;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::Query;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Deserialize;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::utils::config::get_config;

#[derive(Deserialize)]
struct TerminalQuery {
    token: Option<String>,
}

fn is_authorized(token: Option<String>) -> bool {
    match (token, get_config("admin.password", None)) {
        (Some(token), Some(expected)) => token == expected,
        _ => false,
    }
}

fn build_terminal_command() -> CommandBuilder {
    let override_cmd = std::env::var("ARCADER_TERMINAL_CMD").unwrap_or_default();

    let mut builder = if override_cmd.trim().is_empty() {
        let mut b = CommandBuilder::new("sudo");
        b.args(["-n", "/usr/local/sbin/arcader-shell"]);
        b
    } else {
        let parts: Vec<&str> = override_cmd.split_whitespace().collect();
        let mut b = CommandBuilder::new(parts[0]);
        if parts.len() > 1 {
            b.args(&parts[1..]);
        }
        b
    };

    builder.env("TERM", "xterm-256color");
    builder
}

fn build_logs_command() -> Command {
    let override_cmd = std::env::var("ARCADER_LOGS_CMD").unwrap_or_default();

    if override_cmd.trim().is_empty() {
        let mut command = Command::new("journalctl");
        command.args(["--user", "-u", "arcaderd", "-n", "1000", "-f", "--no-pager"]);
        command
    } else {
        let parts: Vec<&str> = override_cmd.split_whitespace().collect();
        let mut command = Command::new(parts[0]);
        if parts.len() > 1 {
            command.args(&parts[1..]);
        }
        command
    }
}

async fn terminal_ws_handler(ws: WebSocketUpgrade, Query(query): Query<TerminalQuery>) -> Response {
    if is_authorized(query.token) {
        ws.on_upgrade(handle_terminal_socket)
    } else {
        (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
    }
}

async fn logs_ws_handler(ws: WebSocketUpgrade, Query(query): Query<TerminalQuery>) -> Response {
    if is_authorized(query.token) {
        ws.on_upgrade(handle_logs_socket)
    } else {
        (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
    }
}

async fn handle_terminal_socket(socket: WebSocket) {
    let pty_system = native_pty_system();

    let pair = match pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        Ok(pair) => pair,
        Err(error) => {
            eprintln!("Failed to open pty: {}", error);
            return;
        }
    };

    let mut child = match pair.slave.spawn_command(build_terminal_command()) {
        Ok(child) => child,
        Err(error) => {
            eprintln!("Failed to spawn terminal shell: {}", error);
            return;
        }
    };

    drop(pair.slave);

    let mut reader = match pair.master.try_clone_reader() {
        Ok(reader) => reader,
        Err(error) => {
            eprintln!("Failed to clone pty reader: {}", error);
            let _ = child.kill();
            return;
        }
    };

    let mut writer = match pair.master.take_writer() {
        Ok(writer) => writer,
        Err(error) => {
            eprintln!("Failed to take pty writer: {}", error);
            let _ = child.kill();
            return;
        }
    };

    let master = pair.master;

    let (out_tx, mut out_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if out_tx.send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let (mut ws_sink, mut ws_stream) = socket.split();

    let mut output_task = tokio::spawn(async move {
        while let Some(chunk) = out_rx.recv().await {
            if ws_sink.send(Message::Binary(chunk)).await.is_err() {
                break;
            }
        }
        let _ = ws_sink.send(Message::Close(None)).await;
    });

    let mut input_task = tokio::spawn(async move {
        while let Some(Ok(message)) = ws_stream.next().await {
            match message {
                Message::Binary(bytes) => {
                    if writer.write_all(&bytes).is_err() {
                        break;
                    }
                    let _ = writer.flush();
                }
                Message::Text(text) => {
                    if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&text) {
                        if map.get("type").and_then(|v| v.as_str()) == Some("resize") {
                            let cols = map.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u16;
                            let rows = map.get("rows").and_then(|v| v.as_u64()).unwrap_or(24) as u16;
                            let _ = master.resize(PtySize {
                                rows: rows.max(1),
                                cols: cols.max(1),
                                pixel_width: 0,
                                pixel_height: 0,
                            });
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = &mut output_task => { input_task.abort(); }
        _ = &mut input_task => { output_task.abort(); }
    }

    let _ = child.kill();
    let _ = child.wait();
}

async fn handle_logs_socket(socket: WebSocket) {
    let mut command = build_logs_command();
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    command.kill_on_drop(true);

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            eprintln!("Failed to start log stream: {}", error);
            return;
        }
    };

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    if let Some(stdout) = child.stdout.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if tx.send(line + "\r\n").is_err() {
                    break;
                }
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if tx.send(line + "\r\n").is_err() {
                    break;
                }
            }
        });
    }

    drop(tx);

    let (mut ws_sink, mut ws_stream) = socket.split();

    let mut output_task = tokio::spawn(async move {
        while let Some(line) = rx.recv().await {
            if ws_sink.send(Message::Text(line)).await.is_err() {
                break;
            }
        }
        let _ = ws_sink.send(Message::Close(None)).await;
    });

    let mut input_task = tokio::spawn(async move {
        while let Some(Ok(message)) = ws_stream.next().await {
            if let Message::Close(_) = message {
                break;
            }
        }
    });

    tokio::select! {
        _ = &mut output_task => { input_task.abort(); }
        _ = &mut input_task => { output_task.abort(); }
    }

    let _ = child.kill().await;
}

pub fn router() -> Router {
    Router::new()
        .route("/ws", get(terminal_ws_handler))
        .route("/logs", get(logs_ws_handler))
}
