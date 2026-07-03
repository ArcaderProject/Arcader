pub mod credits;
pub mod detect;
pub mod flasher;
pub mod reader;
pub mod serial;
pub mod timebank;

use std::time::Duration;

use serde_json::{json, Value};

use crate::daemon::socket::broadcast_to_all;
use crate::utils::config::get_config;
use crate::utils::emulation::{get_current_game, stop};

const RESCAN_INTERVAL: Duration = Duration::from_secs(5);
const WARNING_THRESHOLD_SECONDS: i64 = 60;

pub fn coin_slot_enabled() -> bool {
    get_config("coinScreen.coinSlotEnabled", None).as_deref() == Some("true")
}

pub fn time_mode_enabled() -> bool {
    get_config("coinScreen.timeModeEnabled", None).as_deref() == Some("true")
}

pub fn seconds_per_coin() -> i64 {
    get_config("coinScreen.minutesPerCoin", None)
        .and_then(|m| m.trim().parse::<i64>().ok())
        .filter(|m| *m > 0)
        .unwrap_or(10)
        * 60
}

pub fn time_mode_active() -> bool {
    coin_slot_enabled() && time_mode_enabled() && !credits::is_free_play()
}

pub fn coin_status_value() -> Value {
    json!({
        "credits": credits::get(),
        "remainingSeconds": timebank::get(),
        "timeMode": coin_slot_enabled() && time_mode_enabled(),
        "hardwareConnected": credits::is_hardware_connected(),
        "freePlay": credits::is_free_play(),
    })
}

pub fn coin_status_full() -> Value {
    let mut data = coin_status_value();
    if let Value::Object(ref mut map) = data {
        map.insert(
            "coinSlotEnabled".to_string(),
            Value::Bool(coin_slot_enabled()),
        );
        map.insert(
            "konamiCodeEnabled".to_string(),
            Value::Bool(
                get_config("coinScreen.konamiCodeEnabled", None).as_deref() == Some("true"),
            ),
        );
        if let Some(msg) = get_config("coinScreen.insertMessage", None) {
            map.insert("insertMessage".to_string(), Value::from(msg));
        }
        if let Some(msg) = get_config("coinScreen.infoMessage", None) {
            map.insert("infoMessage".to_string(), Value::from(msg));
        }
    }
    data
}

pub fn try_consume_for_launch() -> Result<bool, String> {
    if !coin_slot_enabled() || credits::is_free_play() {
        return Ok(false);
    }
    if time_mode_enabled() {
        if timebank::get() <= 0 {
            return Err("No time remaining".to_string());
        }
        Ok(false)
    } else if credits::try_consume() {
        Ok(true)
    } else {
        Err("No credits available".to_string())
    }
}

pub fn broadcast_coin_status() {
    broadcast_to_all(&json!({ "type": "COIN_STATUS", "data": coin_status_full() }));
}

pub fn broadcast_coin_inserted() {
    broadcast_to_all(&json!({ "type": "COIN_INSERTED", "data": coin_status_full() }));
}

pub fn register_coin() {
    if coin_slot_enabled() && time_mode_enabled() {
        let total = timebank::add_seconds(seconds_per_coin());
        println!("[coin] Coin inserted; {}s of play time available", total);
    } else {
        let total = credits::add(1);
        println!("[coin] Coin inserted; credits now {}", total);
    }
    broadcast_coin_inserted();
}

fn broadcast_timer(message_type: &str) {
    broadcast_to_all(&json!({
        "type": message_type,
        "data": { "remainingSeconds": timebank::get() },
    }));
}

fn broadcast_timer_tick(remaining: i64) {
    broadcast_to_all(&json!({
        "type": "TIMER_TICK",
        "data": {
            "remainingSeconds": remaining,
            "warning": remaining <= WARNING_THRESHOLD_SECONDS,
        },
    }));
}

pub fn notify_game_started() {
    if time_mode_active() {
        broadcast_timer("TIMER_START");
    }
}

pub fn notify_game_stopped() {
    broadcast_timer("TIMER_STOP");
}

pub async fn run_timer() {
    let mut interval = tokio::time::interval(Duration::from_secs(1));

    loop {
        interval.tick().await;

        if get_current_game().is_some() && time_mode_active() {
            let remaining = timebank::tick(1);
            broadcast_timer_tick(remaining);
            if remaining <= 0 {
                stop();
            }
        }
    }
}

pub fn selftest() {
    match flasher::firmware_hex_path() {
        Some(path) => println!("[coin] Bundled firmware hex: {}", path.display()),
        None => println!("[coin] WARNING: no bundled firmware hex found"),
    }
    match flasher::bundled_version() {
        Some(v) => println!("[coin] Bundled firmware version: v{}", v),
        None => println!("[coin] WARNING: no bundled firmware version found"),
    }

    let boards = detect::find_candidate_boards();
    if boards.is_empty() {
        println!("[coin] No candidate boards detected.");
        return;
    }
    for board in &boards {
        println!(
            "[coin] Candidate: {} (vid={:04x} pid={:04x})",
            board.port_name, board.vid, board.pid
        );
        match flasher::handshake(&board.port_name) {
            Some(version) => println!(
                "[coin]   -> firmware v{} present; would skip if up to date",
                version
            ),
            None => println!("[coin]   -> no Arcader firmware; would flash"),
        }
    }
}

pub fn force_flash() {
    match detect::find_candidate_boards().first() {
        Some(board) => {
            println!("[coin] Force-flashing {}", board.port_name);
            println!(
                "[coin] {}",
                if flasher::flash(&board.port_name) {
                    "Flash OK"
                } else {
                    "Flash FAILED"
                }
            );
        }
        None => println!("[coin] No candidate boards detected; nothing to flash."),
    }
}

pub fn start() {
    std::thread::Builder::new()
        .name("coin-acceptor".to_string())
        .spawn(run_forever)
        .expect("failed to spawn coin acceptor thread");
}

fn run_forever() {
    loop {
        if !coin_slot_enabled() {
            if credits::is_hardware_connected() {
                credits::set_hardware_connected(false);
                broadcast_coin_status();
            }
            std::thread::sleep(RESCAN_INTERVAL);
            continue;
        }

        let board = match detect::find_candidate_boards().into_iter().next() {
            Some(board) => board,
            None => {
                if credits::is_hardware_connected() {
                    credits::set_hardware_connected(false);
                    broadcast_coin_status();
                }
                std::thread::sleep(RESCAN_INTERVAL);
                continue;
            }
        };

        println!(
            "[coin] Found board on {} (vid={:04x} pid={:04x})",
            board.port_name, board.vid, board.pid
        );
        flasher::ensure_firmware(&board.port_name);
        reader::run(&board.port_name);
        std::thread::sleep(RESCAN_INTERVAL);
    }
}
