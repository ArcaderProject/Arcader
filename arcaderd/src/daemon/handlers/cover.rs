use serde_json::{json, Value};

use crate::daemon::socket::{send_response, ClientHandle};
use crate::utils::games::get_cover_art_base64;

pub const GET_COVER_MESSAGE_TYPE: &str = "GET_COVER";

pub fn handle_get_cover(handle: &ClientHandle, request_id: Value, data: Value) {
    let game_id = data.get("gameId").and_then(|v| v.as_str());

    let game_id = match game_id {
        Some(id) if !id.is_empty() => id.to_string(),
        _ => {
            send_response(
                handle,
                &json!({
                    "requestId": request_id,
                    "type": "GET_COVER_RESPONSE",
                    "success": false,
                    "error": "Game ID is required",
                }),
            );
            return;
        }
    };

    let cover_data = get_cover_art_base64(&game_id);

    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "GET_COVER_RESPONSE",
            "success": true,
            "data": {
                "gameId": game_id,
                "coverData": cover_data,
            },
        }),
    );
}
