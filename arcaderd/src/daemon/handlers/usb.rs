use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

use crate::daemon::socket::{send_response, ClientHandle};
use crate::usb::format::{read_manifest, Categories};
use crate::usb::{current_mountpoint, current_status, export, import};

pub const USB_STATUS_MESSAGE_TYPE: &str = "USB_STATUS";
pub const USB_SCAN_MESSAGE_TYPE: &str = "USB_SCAN";
pub const USB_EXPORT_MESSAGE_TYPE: &str = "USB_EXPORT";
pub const USB_IMPORT_MESSAGE_TYPE: &str = "USB_IMPORT";

fn parse_categories(data: &Value) -> Categories {
    let items: Vec<String> = data
        .get("categories")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    Categories::from_list(&items)
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}

pub fn handle_usb_status(handle: &ClientHandle, request_id: Value) {
    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "USB_STATUS_RESPONSE",
            "success": true,
            "data": current_status(),
        }),
    );
}

pub fn handle_usb_scan(handle: &ClientHandle, request_id: Value) {
    let data = match current_mountpoint().and_then(|mp| read_manifest(&mp)) {
        Some(manifest) => json!({
            "hasBackup": true,
            "contents": {
                "games": manifest.contents.games,
                "saves": manifest.contents.saves,
                "lists": manifest.contents.lists,
                "settings": manifest.contents.settings,
            },
        }),
        None => json!({ "hasBackup": false }),
    };

    send_response(
        handle,
        &json!({
            "requestId": request_id,
            "type": "USB_SCAN_RESPONSE",
            "success": true,
            "data": data,
        }),
    );
}

fn spawn_transfer<F>(handle: &ClientHandle, request_id: Value, response_type: &'static str, run: F)
where
    F: FnOnce(PathBuf) -> Result<Value, String> + Send + 'static,
{
    let handle = handle.clone();
    let mountpoint = current_mountpoint();
    std::thread::spawn(move || {
        let response = match mountpoint {
            Some(mp) => match run(mp) {
                Ok(summary) => {
                    json!({ "requestId": request_id, "type": response_type, "success": true, "data": summary })
                }
                Err(error) => {
                    json!({ "requestId": request_id, "type": response_type, "success": false, "error": error })
                }
            },
            None => {
                json!({ "requestId": request_id, "type": response_type, "success": false, "error": "No USB stick mounted" })
            }
        };
        send_response(&handle, &response);
    });
}

pub fn handle_usb_export(handle: &ClientHandle, request_id: Value, data: Value) {
    let cats = parse_categories(&data);
    spawn_transfer(handle, request_id, "USB_EXPORT_RESPONSE", move |mp| {
        export::run_export(&mp, &cats, &timestamp())
    });
}

pub fn handle_usb_import(handle: &ClientHandle, request_id: Value, data: Value) {
    let cats = parse_categories(&data);
    spawn_transfer(handle, request_id, "USB_IMPORT_RESPONSE", move |mp| {
        import::run_import(&mp, &cats)
    });
}
