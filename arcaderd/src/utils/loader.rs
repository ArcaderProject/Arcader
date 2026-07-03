use std::io::Write;
use std::path::PathBuf;

use serde_json::Value;

use crate::utils::config::get_config;
use crate::utils::paths::cwd;

fn cover_path(game_id: &str) -> PathBuf {
    cwd()
        .join("data")
        .join("covers")
        .join(format!("{}.jpg", game_id))
}

async fn download_file(url: &str, file_path: &PathBuf) -> Result<(), String> {
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;

    if response.status().as_u16() != 200 {
        let msg = format!("Failed to get '{}' ({})", url, response.status().as_u16());
        return Err(msg);
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(file_path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_api_key() -> Result<String, String> {
    match get_config("steamGridDbApiKey", None) {
        Some(key) if !key.is_empty() => Ok(key),
        _ => Err("SteamGridDB API key not configured".to_string()),
    }
}

pub async fn lookup_game_id(title: &str) -> Result<Option<Value>, String> {
    let api_key = get_api_key()?;
    let encoded_title = urlencoding(title);

    let client = reqwest::Client::new();
    let response = client
        .get(format!(
            "https://www.steamgriddb.com/api/v2/search/autocomplete/{}",
            encoded_title
        ))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: Value = response.json().await.map_err(|e| e.to_string())?;

    let data = json.get("data").and_then(|d| d.as_array());
    match data {
        Some(arr) if !arr.is_empty() => Ok(Some(arr[0].get("id").cloned().unwrap_or(Value::Null))),
        _ => Ok(None),
    }
}

pub async fn get_game_covers(game_id: &Value, limit: u32) -> Result<Vec<Value>, String> {
    let api_key = get_api_key()?;
    let game_id_str = value_to_string(game_id);

    let client = reqwest::Client::new();
    let response = client
        .get(format!(
            "https://www.steamgriddb.com/api/v2/grids/game/{}?dimensions=600x900&limit={}",
            game_id_str, limit
        ))
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: Value = response.json().await.map_err(|e| e.to_string())?;

    let data = json.get("data").and_then(|d| d.as_array());
    match data {
        Some(arr) if !arr.is_empty() => Ok(arr.clone()),
        _ => Ok(Vec::new()),
    }
}

pub async fn download_cover_by_url(cover_url: &str, game_id: &str) -> bool {
    let path = cover_path(game_id);

    match download_file(cover_url, &path).await {
        Ok(()) => {
            println!("Downloaded cover to {}", path.display());
            true
        }
        Err(e) => {
            eprintln!("Error downloading cover: {}", e);
            false
        }
    }
}

pub async fn download_game_cover(game_name: &str, game_id: &str) -> bool {
    let steam_game_id = match lookup_game_id(game_name).await {
        Ok(Some(id)) => id,
        Ok(None) => {
            println!("No SteamGridDB match found for: {}", game_name);
            return false;
        }
        Err(e) => {
            eprintln!("Error in downloadGameCover for {}: {}", game_name, e);
            return false;
        }
    };

    let covers = match get_game_covers(&steam_game_id, 1).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error in downloadGameCover for {}: {}", game_name, e);
            return false;
        }
    };

    if covers.is_empty() {
        println!("No covers found for: {}", game_name);
        return false;
    }

    let cover_url = match covers[0].get("url").and_then(|u| u.as_str()) {
        Some(u) => u.to_string(),
        None => return false,
    };

    download_cover_by_url(&cover_url, game_id).await
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

fn urlencoding(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        let c = byte as char;
        if c.is_ascii_alphanumeric()
            || matches!(c, '-' | '_' | '.' | '!' | '~' | '*' | '\'' | '(' | ')')
        {
            out.push(c);
        } else {
            out.push_str(&format!("%{:02X}", byte));
        }
    }
    out
}
