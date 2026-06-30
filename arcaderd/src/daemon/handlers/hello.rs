use serde_json::Value;

use crate::daemon::socket::{send_response, ClientHandle};

pub const HELLO_MESSAGE_TYPE: &str = "HELLO";

pub fn handle_say_hello(handle: &ClientHandle, request_id: Value) {
    send_response(
        handle,
        &serde_json::json!({
            "requestId": request_id,
            "type": "HELLO_RESPONSE",
            "success": true,
        }),
    );
}
