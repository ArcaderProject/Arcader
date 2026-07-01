use serde_json::Value;

use crate::utils::database::{execute, query_one_json};

fn config_default(key: &str) -> Option<Option<&'static str>> {
    match key {
        "coinScreen.insertMessage" => Some(Some("INSERT COIN")),
        "coinScreen.infoMessage" => Some(Some(
            "Insert Coin to enter Game Library and choose a Game to play!",
        )),
        "coinScreen.konamiCodeEnabled" => Some(Some("false")),
        "coinScreen.coinSlotEnabled" => Some(Some("true")),
        "coinScreen.timeModeEnabled" => Some(Some("true")),
        "coinScreen.minutesPerCoin" => Some(Some("10")),
        "overlayMenu.chord" => Some(Some("start+select")),
        "steamGridDbApiKey" => Some(None),
        _ => None,
    }
}

const DEFAULT_ADMIN_PASSWORD: &str = "arcader";

pub fn initialize_admin_password() -> String {
    if !has_config("admin.password") {
        let password = std::env::var("ARCADER_ADMIN_PASSWORD")
            .unwrap_or_else(|_| DEFAULT_ADMIN_PASSWORD.to_string());
        set_config("admin.password", &password);
        println!("Admin password initialized");
        return password;
    }
    get_config("admin.password", None).unwrap_or_default()
}

pub fn get_config(key: &str, default_value: Option<&str>) -> Option<String> {
    let result = query_one_json("SELECT value FROM config WHERE key = ?", &[&key]);

    if let Some(row) = result {
        if let Some(Value::String(value)) = row.get("value") {
            return Some(value.clone());
        }
        if matches!(row.get("value"), Some(Value::Null)) {
            return None;
        }
    }

    if default_value.is_none() {
        if let Some(default) = config_default(key) {
            return default.map(|s| s.to_string());
        }
    }

    default_value.map(|s| s.to_string())
}

pub fn set_config(key: &str, value: &str) {
    execute(
        "INSERT OR REPLACE INTO config (key, value) \n        VALUES (?, ?)\n    ",
        &[&key, &value],
    );
}

pub fn has_config(key: &str) -> bool {
    query_one_json("SELECT 1 FROM config WHERE key = ?", &[&key]).is_some()
}

pub fn get_selected_list_id() -> String {
    get_config("selected_list_id", Some("default")).unwrap_or_else(|| "default".to_string())
}
