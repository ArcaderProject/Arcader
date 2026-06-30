pub mod input;

use std::net::UdpSocket;
use std::sync::atomic::{AtomicBool, Ordering};

use serde_json::json;

use crate::daemon::socket::broadcast_to_all;
use crate::utils::emulation::{get_current_game, stop};

static MENU_OPEN: AtomicBool = AtomicBool::new(false);
static PAUSED: AtomicBool = AtomicBool::new(false);

const RA_CMD_ADDR: &str = "127.0.0.1:55355";

pub fn is_open() -> bool {
    MENU_OPEN.load(Ordering::SeqCst)
}

pub fn game_running() -> bool {
    get_current_game().is_some()
}

fn send_ra_command(cmd: &str) {
    if let Ok(sock) = UdpSocket::bind("0.0.0.0:0") {
        let _ = sock.send_to(cmd.as_bytes(), RA_CMD_ADDR);
    }
}

fn set_paused(paused: bool) {
    if PAUSED.swap(paused, Ordering::SeqCst) != paused {
        send_ra_command("PAUSE_TOGGLE");
    }
}

fn broadcast_open() {
    broadcast_to_all(&json!({
        "type": "OVERLAY_OPEN",
        "data": {
            "timeMode": crate::coin::coin_slot_enabled() && crate::coin::time_mode_enabled(),
            "remainingSeconds": crate::coin::timebank::get(),
        }
    }));
}

pub fn open() {
    if game_running() && !MENU_OPEN.swap(true, Ordering::SeqCst) {
        set_paused(true);
        broadcast_open();
    }
}

pub fn close() {
    if MENU_OPEN.swap(false, Ordering::SeqCst) {
        set_paused(false);
        broadcast_to_all(&json!({ "type": "OVERLAY_CLOSE" }));
    }
}

pub fn nav(action: &str) {
    if is_open() {
        broadcast_to_all(&json!({ "type": "OVERLAY_NAV", "data": { "action": action } }));
    }
}

pub fn exit_game() {
    MENU_OPEN.store(false, Ordering::SeqCst);
    PAUSED.store(false, Ordering::SeqCst);
    broadcast_to_all(&json!({ "type": "OVERLAY_CLOSE" }));
    stop();
}

pub fn on_game_stopped() {
    PAUSED.store(false, Ordering::SeqCst);
    if MENU_OPEN.swap(false, Ordering::SeqCst) {
        broadcast_to_all(&json!({ "type": "OVERLAY_CLOSE" }));
    }
}

pub fn start() {
    input::run();
}
