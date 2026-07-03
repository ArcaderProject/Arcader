use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde_json::{json, Value};

use crate::utils::archive::{extract_archive, scan_extracted, ExtractedEntry};
use crate::utils::games::add_game;
use crate::utils::ids::random_hex_id;
use crate::utils::paths::cwd;

const PENDING_TTL: Duration = Duration::from_secs(15 * 60);

struct PendingImport {
    original_filename: String,
    archive_path: PathBuf,
    entries: Vec<ExtractedEntry>,
}

static PENDING: Lazy<Mutex<HashMap<String, PendingImport>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub enum ImportError {
    NotFound,
    Message(String),
}

fn token_dir(token: &str) -> PathBuf {
    cwd().join("data").join("tmp").join("imports").join(token)
}

pub fn stash_archive(original_filename: &str, buffer: &[u8]) -> Result<Value, String> {
    let token = random_hex_id();
    let base = token_dir(&token);
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    let safe_name = Path::new(original_filename)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "upload".to_string());

    let archive_path = base.join(&safe_name);
    let extract_dir = base.join("extracted");

    let entries =
        extract_to_entries(&archive_path, &extract_dir, &safe_name, buffer).inspect_err(|_| {
            let _ = fs::remove_dir_all(&base);
        })?;

    let entries_json: Vec<Value> = entries.iter().map(entry_summary).collect();
    let supported_count = entries.iter().filter(|e| e.supported).count();

    PENDING.lock().unwrap().insert(
        token.clone(),
        PendingImport {
            original_filename: safe_name.clone(),
            archive_path,
            entries,
        },
    );

    schedule_sweep(token.clone());

    Ok(json!({
        "archive": true,
        "token": token,
        "filename": safe_name,
        "entries": entries_json,
        "supportedCount": supported_count,
    }))
}

fn extract_to_entries(
    archive_path: &Path,
    extract_dir: &Path,
    name: &str,
    buffer: &[u8],
) -> Result<Vec<ExtractedEntry>, String> {
    fs::write(archive_path, buffer).map_err(|e| e.to_string())?;
    extract_archive(archive_path, extract_dir, name)?;
    Ok(scan_extracted(extract_dir))
}

fn entry_summary(entry: &ExtractedEntry) -> Value {
    json!({
        "name": entry.name,
        "extension": entry.extension,
        "supported": entry.supported,
        "console": entry.console,
    })
}

pub fn complete_install(token: &str) -> Result<Value, ImportError> {
    let pending = take_pending(token).ok_or(ImportError::NotFound)?;

    let bytes = fs::read(&pending.archive_path).map_err(|e| ImportError::Message(e.to_string()))?;
    let game = add_game(&pending.original_filename, &bytes, None).map_err(ImportError::Message)?;

    cleanup(token);
    Ok(Value::Object(game))
}

pub fn complete_extract(token: &str) -> Result<Value, ImportError> {
    let pending = take_pending(token).ok_or(ImportError::NotFound)?;

    let mut installed: Vec<Value> = Vec::new();
    let mut skipped: Vec<Value> = Vec::new();

    for entry in &pending.entries {
        let outcome = if !entry.supported {
            Err("unsupported extension".to_string())
        } else {
            fs::read(&entry.path)
                .map_err(|e| e.to_string())
                .and_then(|bytes| add_game(&entry.name, &bytes, None))
        };

        match outcome {
            Ok(game) => installed.push(Value::Object(game)),
            Err(reason) => skipped.push(json!({ "name": entry.name, "reason": reason })),
        }
    }

    cleanup(token);

    Ok(json!({
        "installed": installed,
        "skipped": skipped,
        "installedCount": installed.len(),
        "skippedCount": skipped.len(),
    }))
}

pub fn cancel_import(token: &str) -> bool {
    let existed = take_pending(token).is_some();
    cleanup(token);
    existed
}

fn take_pending(token: &str) -> Option<PendingImport> {
    PENDING.lock().unwrap().remove(token)
}

fn cleanup(token: &str) {
    let _ = fs::remove_dir_all(token_dir(token));
}

fn schedule_sweep(token: String) {
    tokio::spawn(async move {
        tokio::time::sleep(PENDING_TTL).await;
        if take_pending(&token).is_some() {
            cleanup(&token);
        }
    });
}
