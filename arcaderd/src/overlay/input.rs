use std::thread;

use evdev::{AbsoluteAxisType, Device, InputEventKind};
use serde_json::Value;

use crate::overlay;
use crate::utils::controller_profiles::resolve_profile_for_game;
use crate::utils::emulation::get_current_game;

const BTN_MISC: u16 = 0x100;
const BTN_JOYSTICK: u16 = 0x120;
const KEY_MAX: u16 = 0x2ff;
const ABS_HAT0X: u16 = 0x10;
const ABS_HAT3Y: u16 = 0x17;

fn is_hat(code: u16) -> bool {
    (ABS_HAT0X..=ABS_HAT3Y).contains(&code)
}

fn is_joypad(device: &Device) -> bool {
    let has_gamepad_button = device.supported_keys().map_or(false, |keys| {
        keys.iter()
            .any(|k| k.code() >= BTN_JOYSTICK && k.code() < KEY_MAX)
    });
    let has_abs = device
        .supported_absolute_axes()
        .map_or(false, |axes| axes.contains(AbsoluteAxisType::ABS_X));
    has_gamepad_button && has_abs
}

fn build_button_index(device: &Device) -> Vec<(u16, u32)> {
    let mut high: Vec<u16> = Vec::new();
    let mut low: Vec<u16> = Vec::new();
    if let Some(keys) = device.supported_keys() {
        for key in keys.iter() {
            let code = key.code();
            if (BTN_JOYSTICK..KEY_MAX).contains(&code) {
                high.push(code);
            } else if (BTN_MISC..BTN_JOYSTICK).contains(&code) {
                low.push(code);
            }
        }
    }
    high.sort_unstable();
    low.sort_unstable();
    high.into_iter()
        .chain(low)
        .enumerate()
        .map(|(i, code)| (code, i as u32))
        .collect()
}

fn build_axis_index(device: &Device) -> Vec<(u16, u32)> {
    let mut codes: Vec<u16> = Vec::new();
    if let Some(axes) = device.supported_absolute_axes() {
        for axis in axes.iter() {
            if !is_hat(axis.0) {
                codes.push(axis.0);
            }
        }
    }
    codes.sort_unstable();
    codes
        .into_iter()
        .enumerate()
        .map(|(i, code)| (code, i as u32))
        .collect()
}

fn build_axis_range(device: &Device, axis_index: &[(u16, u32)]) -> Vec<(u16, i32, i32, i32)> {
    let mut out: Vec<(u16, i32, i32, i32)> = Vec::new();
    if let Ok(states) = device.get_abs_state() {
        for &(code, _) in axis_index {
            let info = states[code as usize];
            out.push((code, info.value, info.minimum, info.maximum));
        }
    }
    out
}

enum Trigger {
    Button(u16),
    Hat {
        code: u16,
        dir: i32,
    },
    Axis {
        code: u16,
        positive: bool,
        rest: i32,
        min: i32,
        max: i32,
    },
}

impl Trigger {
    fn update(&self, is_key: bool, code: u16, value: i32) -> Option<bool> {
        match self {
            Trigger::Button(c) => (is_key && code == *c).then(|| value != 0),
            Trigger::Hat { code: hc, dir } => {
                (!is_key && code == *hc).then(|| value.signum() == *dir)
            }
            Trigger::Axis {
                code: ac,
                positive,
                rest,
                min,
                max,
            } => {
                if is_key || code != *ac {
                    return None;
                }
                let span = (max - min).max(1) as f32;
                let threshold = (span * 0.4) as i32;
                let active = if *positive {
                    value >= rest + threshold
                } else {
                    value <= rest - threshold
                };
                Some(active)
            }
        }
    }
}

fn parse_hat_token(tok: &str) -> Option<Trigger> {
    let rest = tok.strip_prefix('h')?;
    let num_end = rest.find(|c: char| !c.is_ascii_digit())?;
    let num: u16 = rest[..num_end].parse().ok()?;
    let (is_x, sign) = match &rest[num_end..] {
        "up" => (false, -1),
        "down" => (false, 1),
        "left" => (true, -1),
        "right" => (true, 1),
        _ => return None,
    };
    let code = ABS_HAT0X + num * 2 + if is_x { 0 } else { 1 };
    Some(Trigger::Hat { code, dir: sign })
}

fn resolve_trigger(
    bind: &Value,
    button_index: &[(u16, u32)],
    axis_index: &[(u16, u32)],
    axis_range: &[(u16, i32, i32, i32)],
) -> Option<Trigger> {
    let btn = bind.get("btn").and_then(|v| v.as_str()).unwrap_or("nul");
    let axis = bind.get("axis").and_then(|v| v.as_str()).unwrap_or("nul");

    if btn != "nul" {
        if let Some(hat) = parse_hat_token(btn) {
            return Some(hat);
        }
        let idx: u32 = btn.parse().ok()?;
        let code = button_index
            .iter()
            .find(|(_, i)| *i == idx)
            .map(|(c, _)| *c)?;
        return Some(Trigger::Button(code));
    }

    if axis != "nul" {
        let positive = axis.starts_with('+');
        let idx: u32 = axis.trim_start_matches(['+', '-']).parse().ok()?;
        let code = axis_index
            .iter()
            .find(|(_, i)| *i == idx)
            .map(|(c, _)| *c)?;
        let (_, rest, min, max) = *axis_range.iter().find(|(c, ..)| *c == code)?;
        return Some(Trigger::Axis {
            code,
            positive,
            rest,
            min,
            max,
        });
    }

    None
}

struct Actions {
    start: Trigger,
    select: Trigger,
    up: Option<Trigger>,
    down: Option<Trigger>,
    confirm: Option<Trigger>,
    back: Option<Trigger>,
}

fn resolve_actions(
    game_id: &str,
    player_index: usize,
    button_index: &[(u16, u32)],
    axis_index: &[(u16, u32)],
    axis_range: &[(u16, i32, i32, i32)],
) -> Option<Actions> {
    let profile = resolve_profile_for_game(game_id)?;
    let bindings = profile.get("bindings")?;
    let player = bindings
        .get((player_index + 1).to_string())
        .or_else(|| bindings.get("1"))?;

    let get = |name: &str| {
        player
            .get(name)
            .and_then(|b| resolve_trigger(b, button_index, axis_index, axis_range))
    };

    Some(Actions {
        start: get("start")?,
        select: get("select")?,
        up: get("up"),
        down: get("down"),
        confirm: get("a"),
        back: get("b"),
    })
}

fn current_game_id() -> Option<String> {
    get_current_game().and_then(|g| g.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
}

fn device_loop(mut device: Device, player_index: usize) {
    let button_index = build_button_index(&device);
    let axis_index = build_axis_index(&device);
    let axis_range = build_axis_range(&device, &axis_index);

    let mut cur_game: Option<String> = None;
    let mut actions: Option<Actions> = None;

    let mut start_on = false;
    let mut select_on = false;
    let mut chord_latched = false;
    let mut up_on = false;
    let mut down_on = false;
    let mut confirm_on = false;
    let mut back_on = false;

    loop {
        let events = match device.fetch_events() {
            Ok(events) => events,
            Err(_) => return,
        };

        let gid = current_game_id();
        if gid != cur_game {
            cur_game = gid.clone();
            actions = gid.as_ref().and_then(|id| {
                resolve_actions(id, player_index, &button_index, &axis_index, &axis_range)
            });
            start_on = false;
            select_on = false;
            chord_latched = false;
            up_on = false;
            down_on = false;
            confirm_on = false;
            back_on = false;
        }

        let act = match &actions {
            Some(a) => a,
            None => {
                for _ in events {}
                continue;
            }
        };

        for event in events {
            let (is_key, code, value) = match event.kind() {
                InputEventKind::Key(k) => (true, k.code(), event.value()),
                InputEventKind::AbsAxis(a) => (false, a.0, event.value()),
                _ => continue,
            };

            if let Some(n) = act.start.update(is_key, code, value) {
                start_on = n;
            }
            if let Some(n) = act.select.update(is_key, code, value) {
                select_on = n;
            }

            let open = overlay::is_open();
            let nav = |trigger: &Option<Trigger>, held: &mut bool, action: &str| {
                if let Some(t) = trigger {
                    if let Some(n) = t.update(is_key, code, value) {
                        if n && !*held && open {
                            overlay::nav(action);
                        }
                        *held = n;
                    }
                }
            };
            nav(&act.up, &mut up_on, "up");
            nav(&act.down, &mut down_on, "down");
            nav(&act.confirm, &mut confirm_on, "select");
            nav(&act.back, &mut back_on, "back");
        }

        let chord = start_on && select_on;
        if chord && !chord_latched {
            chord_latched = true;
            overlay::open();
        } else if !chord {
            chord_latched = false;
        }
    }
}

pub fn run() {
    let mut pads: Vec<(std::path::PathBuf, Device)> =
        evdev::enumerate().filter(|(_, d)| is_joypad(d)).collect();
    if pads.is_empty() {
        return;
    }
    pads.sort_by(|a, b| a.0.cmp(&b.0));
    for (player_index, (_, device)) in pads.into_iter().enumerate() {
        thread::spawn(move || device_loop(device, player_index));
    }
}
