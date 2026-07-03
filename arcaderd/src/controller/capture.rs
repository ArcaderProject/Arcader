use std::collections::HashSet;
use std::os::unix::io::AsRawFd;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use evdev::{AbsoluteAxisType, Device, InputEventKind};

const BTN_MISC: u16 = 0x100;
const BTN_JOYSTICK: u16 = 0x120;
const KEY_MAX: u16 = 0x2ff;
const ABS_HAT0X: u16 = 0x10;
const ABS_HAT3Y: u16 = 0x17;

const POLL_INTERVAL: Duration = Duration::from_millis(8);
const DRAIN_TIME: Duration = Duration::from_millis(150);
const HOLD_SKIP: Duration = Duration::from_millis(1500);
const CHORD_CANCEL: Duration = Duration::from_millis(1000);

#[derive(Clone, Debug)]
pub struct Binding {
    pub btn: String,
    pub axis: String,
}

impl Binding {
    fn button(index: u32) -> Self {
        Binding {
            btn: index.to_string(),
            axis: "nul".to_string(),
        }
    }
    fn axis(index: u32, positive: bool) -> Self {
        Binding {
            btn: "nul".to_string(),
            axis: format!("{}{}", if positive { "+" } else { "-" }, index),
        }
    }
    fn hat(token: String) -> Self {
        Binding {
            btn: token,
            axis: "nul".to_string(),
        }
    }
}

pub enum CaptureOutcome {
    Captured(Binding),
    Skipped,
    Cancelled,
    Error(String),
}

#[derive(Clone)]
pub struct JoypadInfo {
    pub path: PathBuf,
    pub name: String,
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

pub fn list_joypads() -> Vec<JoypadInfo> {
    let mut pads: Vec<(PathBuf, Device)> =
        evdev::enumerate().filter(|(_, d)| is_joypad(d)).collect();
    pads.sort_by(|a, b| a.0.cmp(&b.0));
    pads.into_iter()
        .map(|(path, device)| JoypadInfo {
            name: device.name().unwrap_or("Unknown Joypad").to_string(),
            path,
        })
        .collect()
}

fn is_hat(code: u16) -> bool {
    (ABS_HAT0X..=ABS_HAT3Y).contains(&code)
}

pub struct CaptureDevice {
    device: Device,
    button_index: Vec<(u16, u32)>,
    axis_index: Vec<(u16, u32)>,
    axis_range: Vec<(u16, i32, i32, i32)>,
}

impl CaptureDevice {
    pub fn open(path: &PathBuf) -> Result<Self, String> {
        let device = Device::open(path).map_err(|e| format!("Failed to open joypad: {}", e))?;

        nix::fcntl::fcntl(
            device.as_raw_fd(),
            nix::fcntl::FcntlArg::F_SETFL(nix::fcntl::OFlag::O_NONBLOCK),
        )
        .map_err(|e| format!("Failed to set non-blocking: {}", e))?;

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
        let button_index: Vec<(u16, u32)> = high
            .into_iter()
            .chain(low)
            .enumerate()
            .map(|(i, code)| (code, i as u32))
            .collect();

        let mut abs_codes: Vec<u16> = Vec::new();
        if let Some(axes) = device.supported_absolute_axes() {
            for axis in axes.iter() {
                if !is_hat(axis.0) {
                    abs_codes.push(axis.0);
                }
            }
        }
        abs_codes.sort_unstable();
        let axis_index: Vec<(u16, u32)> = abs_codes
            .iter()
            .enumerate()
            .map(|(i, code)| (*code, i as u32))
            .collect();

        let mut axis_range: Vec<(u16, i32, i32, i32)> = Vec::new();
        if let Ok(states) = device.get_abs_state() {
            for &(code, _) in &axis_index {
                let info = states[code as usize];
                axis_range.push((code, info.value, info.minimum, info.maximum));
            }
        }

        Ok(CaptureDevice {
            device,
            button_index,
            axis_index,
            axis_range,
        })
    }

    pub fn dump(&self) {
        println!("  buttons (evdev code -> retroarch _btn index):");
        for (code, index) in &self.button_index {
            println!("    0x{:03x} -> {}", code, index);
        }
        println!("  axes (evdev code -> retroarch axis index):");
        for (code, index) in &self.axis_index {
            let rest = self
                .axis_range
                .iter()
                .find(|(c, ..)| c == code)
                .map(|(_, r, mn, mx)| format!("rest={} min={} max={}", r, mn, mx))
                .unwrap_or_default();
            println!("    0x{:03x} -> {}  ({})", code, index, rest);
        }
    }

    fn button_for(&self, code: u16) -> Option<u32> {
        self.button_index
            .iter()
            .find(|(c, _)| *c == code)
            .map(|(_, i)| *i)
    }

    fn axis_for(&self, code: u16) -> Option<u32> {
        self.axis_index
            .iter()
            .find(|(c, _)| *c == code)
            .map(|(_, i)| *i)
    }

    fn axis_deflection(&self, code: u16, value: i32) -> Option<bool> {
        let (_, rest, min, max) = *self.axis_range.iter().find(|(c, ..)| *c == code)?;
        let span = (max - min).max(1) as f32;
        let threshold = (span * 0.4) as i32;
        if value <= rest - threshold {
            Some(false)
        } else if value >= rest + threshold {
            Some(true)
        } else {
            None
        }
    }

    fn hat_token(code: u16, value: i32) -> Option<String> {
        if value == 0 {
            return None;
        }
        let hat_number = (code - ABS_HAT0X) / 2;
        let is_x = (code - ABS_HAT0X) % 2 == 0;
        let dir = if is_x {
            if value < 0 {
                "left"
            } else {
                "right"
            }
        } else if value < 0 {
            "up"
        } else {
            "down"
        };
        Some(format!("h{}{}", hat_number, dir))
    }

    fn drain(&mut self) {
        let start = Instant::now();
        while start.elapsed() < DRAIN_TIME {
            match self.device.fetch_events() {
                Ok(events) => for _ in events {},
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(POLL_INTERVAL);
                }
                Err(_) => break,
            }
        }
    }

    fn abs_deflected(&self, code: u16, value: i32) -> bool {
        if is_hat(code) {
            value != 0
        } else {
            self.axis_deflection(code, value).is_some()
        }
    }

    pub fn capture_next(&mut self, skip: &AtomicBool, cancel: &AtomicBool) -> CaptureOutcome {
        self.drain();

        let mut disarmed: HashSet<u16> = HashSet::new();
        if let Ok(states) = self.device.get_abs_state() {
            for &(code, ..) in &self.axis_range {
                if self.abs_deflected(code, states[code as usize].value) {
                    disarmed.insert(code);
                }
            }
            for code in ABS_HAT0X..=ABS_HAT3Y {
                if states[code as usize].value != 0 {
                    disarmed.insert(code);
                }
            }
        }

        let mut pressed: Vec<(u16, Instant)> = Vec::new();
        let mut multi_seen = false;

        loop {
            if cancel.load(Ordering::SeqCst) {
                return CaptureOutcome::Cancelled;
            }
            if skip.swap(false, Ordering::SeqCst) {
                return CaptureOutcome::Skipped;
            }

            let events: Vec<evdev::InputEvent> = match self.device.fetch_events() {
                Ok(events) => events.collect(),
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Vec::new(),
                Err(e) => return CaptureOutcome::Error(format!("Joypad read error: {}", e)),
            };

            for event in events {
                match event.kind() {
                    InputEventKind::Key(key) => {
                        let code = key.code();
                        if self.button_for(code).is_none() {
                            continue;
                        }
                        match event.value() {
                            1 => {
                                if !pressed.iter().any(|(c, _)| *c == code) {
                                    pressed.push((code, Instant::now()));
                                }
                                if pressed.len() >= 2 {
                                    multi_seen = true;
                                }
                            }
                            0 => {
                                if let Some(pos) = pressed.iter().position(|(c, _)| *c == code) {
                                    let (_, at) = pressed.remove(pos);
                                    if pressed.is_empty() {
                                        if !multi_seen && at.elapsed() < HOLD_SKIP {
                                            if let Some(index) = self.button_for(code) {
                                                return CaptureOutcome::Captured(Binding::button(
                                                    index,
                                                ));
                                            }
                                        }
                                        multi_seen = false;
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    InputEventKind::AbsAxis(axis) => {
                        let code = axis.0;
                        let value = event.value();

                        if !self.abs_deflected(code, value) {
                            disarmed.remove(&code);
                            continue;
                        }

                        if !pressed.is_empty() || multi_seen || disarmed.contains(&code) {
                            continue;
                        }
                        if is_hat(code) {
                            if let Some(token) = Self::hat_token(code, value) {
                                return CaptureOutcome::Captured(Binding::hat(token));
                            }
                        } else if let Some(positive) = self.axis_deflection(code, value) {
                            if let Some(index) = self.axis_for(code) {
                                return CaptureOutcome::Captured(Binding::axis(index, positive));
                            }
                        }
                    }
                    _ => {}
                }
            }

            if pressed.len() >= 2 {
                let newest_hold = pressed
                    .iter()
                    .map(|(_, at)| at.elapsed())
                    .min()
                    .unwrap_or_default();
                if newest_hold >= CHORD_CANCEL {
                    return CaptureOutcome::Cancelled;
                }
            } else if let Some((_, at)) = pressed.first() {
                if !multi_seen && at.elapsed() >= HOLD_SKIP {
                    return CaptureOutcome::Skipped;
                }
            }

            std::thread::sleep(POLL_INTERVAL);
        }
    }
}
