use serde_json::{json, Value};

use crate::daemon::socket::{send_response, ClientHandle};
use crate::utils::games::get_filtered_games;

pub const GET_GAMES_MESSAGE_TYPE: &str = "GET_GAMES";

pub fn handle_get_games(handle: &ClientHandle, request_id: Value) {
    let games = get_filtered_games();

    let formatted_games: Vec<Value> = games
        .iter()
        .map(|game| {
            json!({
                "id": game.get("id").cloned().unwrap_or(Value::Null),
                "name": game.get("name").cloned().unwrap_or(Value::Null),
                "console": game.get("console").cloned().unwrap_or(Value::Null),
                "extension": game.get("extension").cloned().unwrap_or(Value::Null),
                "filename": game.get("filename").cloned().unwrap_or(Value::Null),
                "cover_art": game.get("cover_art").and_then(|v| v.as_i64()).map(|n| n == 1).unwrap_or(false),
            })
        })
        .collect();

    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "GET_GAMES_RESPONSE",
            "success": true,
            "data": { "games": formatted_games },
        }),
    );
}
