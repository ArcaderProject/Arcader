use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use once_cell::sync::Lazy;
use serde_json::json;

use crate::controller::capture::{CaptureDevice, CaptureOutcome};
use crate::daemon::socket::broadcast_to_all;
use crate::utils::controller_profiles::{get_profile, save_binding, RETROPAD_BINDS};
use crate::utils::emulation::get_current_game;

struct ActiveSession {
    profile_id: String,
    skip: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
}

static ACTIVE: Lazy<std::sync::Mutex<Option<ActiveSession>>> =
    Lazy::new(|| std::sync::Mutex::new(None));

pub fn is_active() -> bool {
    ACTIVE.lock().unwrap().is_some()
}

pub fn active_profile_id() -> Option<String> {
    ACTIVE
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.profile_id.clone())
}

pub fn skip() {
    if let Some(session) = ACTIVE.lock().unwrap().as_ref() {
        session.skip.store(true, Ordering::SeqCst);
    }
}

pub fn cancel() {
    let profile_id = {
        let guard = ACTIVE.lock().unwrap();
        match guard.as_ref() {
            Some(session) => {
                session.cancel.store(true, Ordering::SeqCst);
                session.profile_id.clone()
            }
            None => return,
        }
    };
    finish(&profile_id, true, None);
}

struct FinishGuard {
    profile_id: String,
}

impl Drop for FinishGuard {
    fn drop(&mut self) {
        finish(&self.profile_id, true, None);
    }
}

fn selection_screen() -> &'static str {
    if !crate::coin::coin_slot_enabled() || crate::coin::credits::is_free_play() {
        return "SELECTION";
    }
    let exhausted = if crate::coin::time_mode_enabled() {
        crate::coin::timebank::get() <= 0
    } else {
        crate::coin::credits::get() == 0
    };
    if exhausted {
        "COIN"
    } else {
        "SELECTION"
    }
}

fn send(message: serde_json::Value) {
    broadcast_to_all(&message);
}

fn finish(profile_id: &str, cancelled: bool, error: Option<String>) {
    if ACTIVE.lock().unwrap().take().is_none() {
        return;
    }
    send(json!({
        "type": "CONFIG_DONE",
        "data": {
            "profileId": profile_id,
            "cancelled": cancelled,
            "error": error,
        }
    }));
    send(json!({ "type": "UPDATE_SCREEN", "data": { "screen": selection_screen() } }));
}

pub fn start(profile_id: &str) -> Result<(), String> {
    if get_current_game().is_some() {
        return Err("Cannot configure controllers while a game is running".to_string());
    }
    if is_active() {
        return Err("A controller configuration is already in progress".to_string());
    }

    let profile = get_profile(profile_id).ok_or_else(|| "Profile not found".to_string())?;
    let profile_name = profile
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Profile")
        .to_string();

    let joypads = crate::controller::capture::list_joypads();
    if joypads.is_empty() {
        return Err("No joypads detected. Connect a controller and try again.".to_string());
    }

    let skip = Arc::new(AtomicBool::new(false));
    let cancel = Arc::new(AtomicBool::new(false));

    *ACTIVE.lock().unwrap() = Some(ActiveSession {
        profile_id: profile_id.to_string(),
        skip: skip.clone(),
        cancel: cancel.clone(),
    });

    let profile_id = profile_id.to_string();

    std::thread::spawn(move || {
        run_session(profile_id, profile_name, joypads, skip, cancel);
    });

    Ok(())
}

fn run_session(
    profile_id: String,
    profile_name: String,
    joypads: Vec<crate::controller::capture::JoypadInfo>,
    skip: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
) {
    let _guard = FinishGuard {
        profile_id: profile_id.clone(),
    };

    send(json!({ "type": "UPDATE_SCREEN", "data": { "screen": "CONTROLLER_CONFIG" } }));

    let total_players = joypads.len();
    let total_binds = RETROPAD_BINDS.len();

    for (player_offset, joypad) in joypads.iter().enumerate() {
        let player = (player_offset + 1) as u32;

        let mut device = match CaptureDevice::open(&joypad.path) {
            Ok(d) => d,
            Err(error) => {
                finish(&profile_id, false, Some(error));
                return;
            }
        };

        for (index, (bind_key, label)) in RETROPAD_BINDS.iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                finish(&profile_id, true, None);
                return;
            }

            send(json!({
                "type": "CONFIG_PROMPT",
                "data": {
                    "profileId": profile_id,
                    "profileName": profile_name,
                    "player": player,
                    "totalPlayers": total_players,
                    "joypadName": joypad.name,
                    "input": bind_key,
                    "label": label,
                    "index": index,
                    "total": total_binds,
                }
            }));

            match device.capture_next(&skip, &cancel) {
                CaptureOutcome::Captured(binding) => {
                    if let Err(error) =
                        save_binding(&profile_id, player, bind_key, &binding.btn, &binding.axis)
                    {
                        finish(&profile_id, false, Some(error));
                        return;
                    }
                    send(json!({
                        "type": "CONFIG_CAPTURED",
                        "data": {
                            "input": bind_key,
                            "btn": binding.btn,
                            "axis": binding.axis,
                            "skipped": false,
                        }
                    }));
                }
                CaptureOutcome::Skipped => {
                    send(json!({
                        "type": "CONFIG_CAPTURED",
                        "data": { "input": bind_key, "skipped": true }
                    }));
                }
                CaptureOutcome::Cancelled => {
                    finish(&profile_id, true, None);
                    return;
                }
                CaptureOutcome::Error(error) => {
                    finish(&profile_id, false, Some(error));
                    return;
                }
            }
        }
    }

    finish(&profile_id, false, None);
}
