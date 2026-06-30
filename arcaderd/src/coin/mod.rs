pub mod credits;
pub mod detect;
pub mod flasher;
pub mod reader;
pub mod serial;

use std::time::Duration;

use serde_json::{json, Value};

use crate::daemon::socket::broadcast_to_all;
use crate::utils::config::get_config;

const RESCAN_INTERVAL: Duration = Duration::from_secs(5);

pub fn coin_status_value() -> Value {
    json!({
        "credits": credits::get(),
        "hardwareConnected": credits::is_hardware_connected(),
        "freePlay": credits::is_free_play(),
    })
}

pub fn broadcast_coin_status() {
    broadcast_to_all(&json!({ "type": "COIN_STATUS", "data": coin_status_value() }));
}

pub fn broadcast_coin_inserted(credits_total: u32) {
    broadcast_to_all(&json!({
        "type": "COIN_INSERTED",
        "data": {
            "credits": credits_total,
            "hardwareConnected": credits::is_hardware_connected(),
        },
    }));
}

pub fn coin_slot_enabled() -> bool {
    get_config("coinScreen.coinSlotEnabled", None).as_deref() == Some("true")
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
        println!("[coin] Candidate: {} (vid={:04x} pid={:04x})", board.port_name, board.vid, board.pid);
        match flasher::handshake(&board.port_name) {
            Some(version) => println!("[coin]   -> firmware v{} present; would skip if up to date", version),
            None => println!("[coin]   -> no Arcader firmware; would flash"),
        }
    }
}

pub fn force_flash() {
    match detect::find_candidate_boards().first() {
        Some(board) => {
            println!("[coin] Force-flashing {}", board.port_name);
            println!("[coin] {}", if flasher::flash(&board.port_name) { "Flash OK" } else { "Flash FAILED" });
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

        println!("[coin] Found board on {} (vid={:04x} pid={:04x})", board.port_name, board.vid, board.pid);
        flasher::ensure_firmware(&board.port_name);
        reader::run(&board.port_name);
        std::thread::sleep(RESCAN_INTERVAL);
    }
}
