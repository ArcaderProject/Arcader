use serde_json::{json, Value};

use crate::coin::{credits, try_consume_for_launch};
use crate::daemon::socket::{send_response, ClientHandle};
use crate::utils::apps::{get_app_by_id, get_app_icon_base64, get_enabled_apps, to_client_json};
use crate::utils::emulation::{get_current_game, launch_app};

pub const GET_APPS_MESSAGE_TYPE: &str = "GET_APPS";
pub const GET_APP_ICON_MESSAGE_TYPE: &str = "GET_APP_ICON";
pub const LAUNCH_APP_MESSAGE_TYPE: &str = "LAUNCH_APP";

pub fn handle_get_apps(handle: &ClientHandle, request_id: Value) {
    let apps: Vec<Value> = get_enabled_apps().iter().map(to_client_json).collect();

    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "GET_APPS_RESPONSE",
            "success": true,
            "data": { "apps": apps },
        }),
    );
}

pub fn handle_get_app_icon(handle: &ClientHandle, request_id: Value, data: Value) {
    let app_id = data.get("appId").and_then(|v| v.as_str());

    let app_id = match app_id {
        Some(id) if !id.is_empty() => id.to_string(),
        _ => {
            send_response(
                handle,
                &json!({
                    "requestId": request_id,
                    "type": "GET_APP_ICON_RESPONSE",
                    "success": false,
                    "error": "App ID is required",
                }),
            );
            return;
        }
    };

    let icon_data = get_app_icon_base64(&app_id);

    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "GET_APP_ICON_RESPONSE",
            "success": true,
            "data": {
                "appId": app_id,
                "iconData": icon_data,
            },
        }),
    );
}

pub fn handle_launch_app(handle: &ClientHandle, request_id: Value, data: Value) {
    match launch_app_inner(request_id.clone(), data) {
        Ok(response) => send_response(handle, &response),
        Err(error) => {
            eprintln!("Error launching app: {}", error);
            send_response(
                handle,
                &json!({
                    "requestId": request_id,
                    "type": "LAUNCH_APP_ERROR",
                    "error": error,
                }),
            );
        }
    }
}

fn launch_app_inner(request_id: Value, data: Value) -> Result<Value, String> {
    let app_id = match data.get("appId").and_then(|v| v.as_str()) {
        Some(id) if !id.is_empty() => id.to_string(),
        _ => return Err("App ID is required".to_string()),
    };

    let app = get_app_by_id(&app_id).ok_or_else(|| "App not found".to_string())?;

    if get_current_game().is_some() {
        return Err("Content is already running".to_string());
    }

    let consumed_credit = try_consume_for_launch()?;

    let app_json = to_client_json(&app);

    if let Err(error) = launch_app(&app_json) {
        if consumed_credit {
            credits::add(1);
        }
        return Err(error);
    }

    if consumed_credit {
        crate::coin::broadcast_coin_status();
    }

    Ok(json!({
        "requestId": request_id,
        "type": "LAUNCH_APP_RESPONSE",
        "data": {
            "success": true,
            "app": {
                "id": app.get("id").cloned().unwrap_or(Value::Null),
                "name": app.get("name").cloned().unwrap_or(Value::Null),
                "type": app.get("type").cloned().unwrap_or(Value::Null),
            },
        },
    }))
}
