use serde_json::{json, Value};

use crate::coin::{broadcast_coin_status, coin_status_full, credits};
use crate::daemon::socket::{send_error, send_response, ClientHandle};
use crate::utils::config::get_config;

pub const GET_COIN_STATUS_MESSAGE_TYPE: &str = "GET_COIN_STATUS";
pub const SET_FREE_PLAY_MESSAGE_TYPE: &str = "SET_FREE_PLAY";

fn status_data() -> Value {
    coin_status_full()
}

pub fn handle_get_coin_status(handle: &ClientHandle, request_id: Value) {
    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "GET_COIN_STATUS_RESPONSE",
            "success": true,
            "data": status_data(),
        }),
    );
}

pub fn handle_set_free_play(handle: &ClientHandle, request_id: Value, data: Value) {
    let enabled = data.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
    let konami_enabled = get_config("coinScreen.konamiCodeEnabled", None).as_deref() == Some("true");

    if enabled && !konami_enabled {
        send_error(handle, "Free play (Konami code) is disabled", request_id);
        return;
    }

    credits::set_free_play(enabled);
    broadcast_coin_status();
    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "SET_FREE_PLAY_RESPONSE",
            "success": true,
            "data": status_data(),
        }),
    );
}
