use std::collections::HashMap;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use once_cell::sync::Lazy;
use rand::Rng;
use serde_json::Value;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixListener;
use tokio::sync::mpsc::{self, UnboundedSender};

use crate::daemon::handlers::dispatch;

pub type ClientHandle = UnboundedSender<String>;

static CLIENTS: Lazy<std::sync::Mutex<HashMap<String, ClientHandle>>> =
    Lazy::new(|| std::sync::Mutex::new(HashMap::new()));

const ARCADER_SOCKET_NAME: &str = "arcaderd.sock";

fn socket_path() -> PathBuf {
    let runtime_dir =
        std::env::var("XDG_RUNTIME_DIR").expect("XDG_RUNTIME_DIR environment variable not set");
    PathBuf::from(runtime_dir).join(ARCADER_SOCKET_NAME)
}

pub fn broadcast_to_all(message: &Value) {
    let message_str = message.to_string() + "\n";
    let clients = CLIENTS.lock().unwrap();
    for client in clients.values() {
        if let Err(error) = client.send(message_str.clone()) {
            eprintln!("Error broadcasting to client: {}", error);
        }
    }
}

pub fn broadcast_games_updated() {
    broadcast_to_all(&serde_json::json!({ "type": "GAMES_UPDATED" }));
}

pub fn broadcast_cover_updated(game_id: &str) {
    broadcast_to_all(&serde_json::json!({
        "type": "COVER_UPDATED",
        "data": { "gameId": game_id },
    }));
}

pub fn broadcast_apps_updated() {
    broadcast_to_all(&serde_json::json!({ "type": "APPS_UPDATED" }));
}

pub fn send_response(handle: &ClientHandle, response: &Value) {
    let json_response = response.to_string() + "\n";
    if let Err(error) = handle.send(json_response) {
        eprintln!("Error sending response: {}", error);
    }
}

pub fn send_error(handle: &ClientHandle, error_message: &str, request_id: Value) {
    send_response(
        handle,
        &serde_json::json!({
            "requestId": request_id,
            "type": "ERROR",
            "success": false,
            "error": error_message,
        }),
    );
}

pub async fn handle_message(handle: &ClientHandle, message: Value) {
    let message_type = message
        .get("type")
        .and_then(|v| v.as_str())
        .map(String::from);
    let request_id = message.get("requestId").cloned().unwrap_or(Value::Null);
    let data = message.get("data").cloned().unwrap_or(Value::Null);

    match message_type {
        Some(t) => {
            if !dispatch(&t, handle, request_id.clone(), data).await {
                send_error(handle, &format!("Unknown message type: {}", t), request_id);
            }
        }
        None => {
            send_error(handle, "Unknown message type: undefined", request_id);
        }
    }
}

pub fn shutdown() {
    println!("Shutting down...");

    {
        let clients = CLIENTS.lock().unwrap();
        for client_id in clients.keys() {
            println!("Closing connection to {}", client_id);
        }
    }

    let path = socket_path();
    println!("Server closed");
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }
    std::process::exit(0);
}

fn generate_client_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let suffix: String = {
        let mut rng = rand::thread_rng();
        (0..7)
            .map(|_| {
                let chars = b"0123456789abcdefghijklmnopqrstuvwxyz";
                chars[rng.gen_range(0..chars.len())] as char
            })
            .collect()
    };
    format!("client_{}_{}", millis, suffix)
}

pub async fn start_daemon_socket() {
    let path = socket_path();
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }

    let listener = UnixListener::bind(&path).expect("Failed to bind daemon socket");

    println!("Game daemon started on {}", path.display());
    if let Some(parent) = path.parent() {
        if let Ok(meta) = std::fs::metadata(parent) {
            println!(
                "Socket directory permissions: {:o}",
                meta.permissions().mode()
            );
        }
    }

    tokio::spawn(async {
        let mut sigterm =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).unwrap();
        tokio::select! {
            _ = tokio::signal::ctrl_c() => shutdown(),
            _ = sigterm.recv() => shutdown(),
        }
    });

    loop {
        let (stream, _addr) = match listener.accept().await {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Socket accept error: {}", e);
                continue;
            }
        };

        let client_id = generate_client_id();
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        CLIENTS
            .lock()
            .unwrap()
            .insert(client_id.clone(), tx.clone());

        let (mut read_half, mut write_half) = stream.into_split();

        tokio::spawn(async move {
            while let Some(message) = rx.recv().await {
                if write_half.write_all(message.as_bytes()).await.is_err() {
                    break;
                }
            }
        });

        let reader_client_id = client_id.clone();
        let handle = tx.clone();
        tokio::spawn(async move {
            let mut message_buffer: Vec<u8> = Vec::new();
            let mut buf = [0u8; 8192];

            loop {
                match read_half.read(&mut buf).await {
                    Ok(0) => {
                        println!("Client disconnected: {}", reader_client_id);
                        CLIENTS.lock().unwrap().remove(&reader_client_id);
                        break;
                    }
                    Ok(n) => {
                        message_buffer.extend_from_slice(&buf[..n]);

                        while let Some(newline_pos) =
                            message_buffer.iter().position(|&b| b == b'\n')
                        {
                            let line: Vec<u8> = message_buffer.drain(..=newline_pos).collect();
                            let complete_message = String::from_utf8_lossy(&line[..line.len() - 1]);

                            if !complete_message.trim().is_empty() {
                                match serde_json::from_str::<Value>(&complete_message) {
                                    Ok(message) => handle_message(&handle, message).await,
                                    Err(error) => {
                                        eprintln!("Error parsing message: {}", error);
                                        send_error(&handle, "Invalid JSON format", Value::Null);
                                    }
                                }
                            }
                        }
                    }
                    Err(error) => {
                        eprintln!("Socket error for {}: {}", reader_client_id, error);
                        CLIENTS.lock().unwrap().remove(&reader_client_id);
                        break;
                    }
                }
            }
        });
    }
}
