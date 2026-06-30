use std::collections::HashSet;
use std::thread;

use evdev::{Device, InputEventKind, Key};

use crate::overlay;
use crate::utils::config::get_config;

fn token_to_code(token: &str) -> Option<u16> {
    Some(match token {
        "start" | "enter" => Key::KEY_ENTER.code(),
        "select" | "rshift" => Key::KEY_RIGHTSHIFT.code(),
        "a" => Key::KEY_X.code(),
        "b" => Key::KEY_Z.code(),
        "x" => Key::KEY_S.code(),
        "y" => Key::KEY_A.code(),
        "l" => Key::KEY_Q.code(),
        "r" => Key::KEY_W.code(),
        _ => return None,
    })
}

fn chord_codes() -> (u16, u16) {
    let default = (Key::KEY_ENTER.code(), Key::KEY_RIGHTSHIFT.code());
    let cfg = match get_config("overlayMenu.chord", None) {
        Some(c) => c,
        None => return default,
    };
    let parts: Vec<&str> = cfg.split('+').map(|s| s.trim()).collect();
    if parts.len() == 2 {
        if let (Some(a), Some(b)) = (token_to_code(parts[0]), token_to_code(parts[1])) {
            return (a, b);
        }
    }
    default
}

fn open_keyboards() -> Vec<Device> {
    evdev::enumerate()
        .filter(|(_, device)| {
            device
                .supported_keys()
                .map_or(false, |keys| keys.contains(Key::KEY_ENTER))
        })
        .map(|(_, device)| device)
        .collect()
}

fn handle_nav(code: u16) {
    if code == Key::KEY_UP.code() {
        overlay::nav("up");
    } else if code == Key::KEY_DOWN.code() {
        overlay::nav("down");
    } else if code == Key::KEY_X.code() || code == Key::KEY_ENTER.code() {
        overlay::nav("select");
    } else if code == Key::KEY_Z.code() {
        overlay::nav("back");
    }
}

fn device_loop(mut device: Device, chord_a: u16, chord_b: u16) {
    let mut pressed: HashSet<u16> = HashSet::new();
    let mut chord_active = false;

    loop {
        let events = match device.fetch_events() {
            Ok(events) => events,
            Err(_) => return,
        };

        for event in events {
            if let InputEventKind::Key(key) = event.kind() {
                let code = key.code();
                match event.value() {
                    1 => {
                        pressed.insert(code);
                        if overlay::is_open() {
                            handle_nav(code);
                        }
                    }
                    0 => {
                        pressed.remove(&code);
                    }
                    _ => {}
                }
            }
        }

        let chord = pressed.contains(&chord_a) && pressed.contains(&chord_b);
        if chord && !chord_active {
            chord_active = true;
            overlay::open();
        } else if !chord {
            chord_active = false;
        }
    }
}

pub fn run() {
    let devices = open_keyboards();
    if devices.is_empty() {
        return;
    }
    let (chord_a, chord_b) = chord_codes();
    for device in devices {
        thread::spawn(move || device_loop(device, chord_a, chord_b));
    }
}
