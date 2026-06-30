use serde_json::{json, Value};

use crate::coin::{coin_slot_enabled, credits, time_mode_enabled, timebank};
use crate::daemon::socket::{broadcast_to_all, send_response, ClientHandle};
use crate::utils::emulation::{get_current_game, start_by_filename};
use crate::utils::games::get_all_games;

pub const START_GAME_MESSAGE_TYPE: &str = "START_GAME";

pub fn broadcast_update_screen(screen: &str) {
    broadcast_to_all(&json!({ "type": "UPDATE_SCREEN", "data": { "screen": screen } }));
}

pub async fn handle_start_game(handle: &ClientHandle, request_id: Value, data: Value) {
    match start_game_inner(request_id.clone(), data).await {
        Ok(response) => send_response(handle, &response),
        Err(error) => {
            eprintln!("Error starting game: {}", error);
            send_response(
                handle,
                &json!({
                    "requestId": request_id,
                    "type": "START_GAME_ERROR",
                    "error": error,
                }),
            );
        }
    }
}

async fn start_game_inner(request_id: Value, data: Value) -> Result<Value, String> {
    let game_uuid = data.get("gameUuid").and_then(|v| v.as_str());
    let game_uuid = match game_uuid {
        Some(id) if !id.is_empty() => id.to_string(),
        _ => return Err("Game ID is required".to_string()),
    };

    let games = get_all_games();
    let game = games
        .into_iter()
        .find(|g| g.get("id").and_then(|v| v.as_str()) == Some(game_uuid.as_str()))
        .ok_or_else(|| "Game not found".to_string())?;

    if get_current_game().is_some() {
        return Err("A game is already running".to_string());
    }

    let mut consumed_credit = false;
    if coin_slot_enabled() && !credits::is_free_play() {
        if time_mode_enabled() {
            if timebank::get() <= 0 {
                return Err("No time remaining".to_string());
            }
        } else if credits::try_consume() {
            consumed_credit = true;
        } else {
            return Err("No credits available".to_string());
        }
    }

    let filename = game
        .get("filename")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    if !start_by_filename(&filename, Some(Value::Object(game.clone()))) {
        if consumed_credit {
            credits::add(1);
        }
        return Err("Failed to start game".to_string());
    }

    if consumed_credit {
        crate::coin::broadcast_coin_status();
    }

    Ok(json!({
        "requestId": request_id,
        "type": "START_GAME_RESPONSE",
        "data": {
            "success": true,
            "game": {
                "id": game.get("id").cloned().unwrap_or(Value::Null),
                "name": game.get("name").cloned().unwrap_or(Value::Null),
                "filename": game.get("filename").cloned().unwrap_or(Value::Null),
            },
        },
    }))
}
