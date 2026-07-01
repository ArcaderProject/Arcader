pub mod export;
pub mod format;
pub mod import;

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde_json::{json, Value};

use crate::daemon::socket::broadcast_to_all;

const POLL_INTERVAL: Duration = Duration::from_millis(1500);
const MOUNT_HELPER: &str = "/usr/local/sbin/arcader-usb";

#[derive(Clone, Debug, PartialEq)]
enum MountMethod {
    Premounted,
    Helper,
    Udisks,
}

#[derive(Clone, Debug)]
struct UsbState {
    device: String,
    mountpoint: PathBuf,
    label: Option<String>,
    method: MountMethod,
}

static CURRENT: Lazy<std::sync::Mutex<Option<UsbState>>> =
    Lazy::new(|| std::sync::Mutex::new(None));

pub fn emit_progress(stage: &str, current: usize, total: usize) {
    broadcast_to_all(&json!({
        "type": "USB_PROGRESS",
        "data": { "stage": stage, "current": current, "total": total },
    }));
}

pub fn current_mountpoint() -> Option<PathBuf> {
    CURRENT.lock().unwrap().as_ref().map(|s| s.mountpoint.clone())
}

pub fn current_status() -> Value {
    match CURRENT.lock().unwrap().as_ref() {
        Some(state) => json!({
            "inserted": true,
            "mountpoint": state.mountpoint.to_string_lossy(),
            "label": state.label,
        }),
        None => json!({ "inserted": false }),
    }
}

pub fn start() {
    std::thread::Builder::new()
        .name("usb-watcher".to_string())
        .spawn(run_forever)
        .expect("failed to spawn usb watcher thread");
}

fn run_forever() {
    loop {
        match detect_candidate() {
            Some(candidate) => {
                let already = CURRENT
                    .lock()
                    .unwrap()
                    .as_ref()
                    .map(|s| s.device == candidate.device)
                    .unwrap_or(false);
                if !already {
                    if CURRENT.lock().unwrap().is_some() {
                        handle_removed();
                    }
                    handle_inserted(candidate);
                }
            }
            None => {
                if CURRENT.lock().unwrap().is_some() {
                    handle_removed();
                }
            }
        }

        std::thread::sleep(POLL_INTERVAL);
    }
}

fn handle_inserted(candidate: Candidate) {
    if let Ok(state) = mount(&candidate) {
        let payload = json!({
            "mountpoint": state.mountpoint.to_string_lossy(),
            "label": state.label,
        });
        *CURRENT.lock().unwrap() = Some(state);
        broadcast_to_all(&json!({ "type": "USB_INSERTED", "data": payload }));
    }
}

fn handle_removed() {
    let state = CURRENT.lock().unwrap().take();
    if let Some(state) = state {
        unmount(&state);
        broadcast_to_all(&json!({ "type": "USB_REMOVED", "data": {} }));
    }
}

#[derive(Clone, Debug)]
struct Candidate {
    device: String,
    label: Option<String>,
    mountpoint: Option<PathBuf>,
}

fn truthy(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => s == "1" || s.eq_ignore_ascii_case("true"),
        Some(Value::Number(n)) => n.as_i64().map(|i| i != 0).unwrap_or(false),
        _ => false,
    }
}

fn detect_candidate() -> Option<Candidate> {
    let output = Command::new("lsblk")
        .args(["-J", "-o", "NAME,PATH,TYPE,RM,HOTPLUG,MOUNTPOINT,FSTYPE,LABEL"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let json: Value = serde_json::from_slice(&output.stdout).ok()?;
    let devices = json.get("blockdevices").and_then(|v| v.as_array())?;

    for disk in devices {
        if !truthy(disk.get("rm")) && !truthy(disk.get("hotplug")) {
            continue;
        }

        let parts: Vec<&Value> = disk
            .get("children")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().collect())
            .unwrap_or_else(|| vec![disk]);

        for part in parts {
            let kind = part.get("type").and_then(|v| v.as_str());
            let has_fs = part.get("fstype").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
            if (kind != Some("part") && kind != Some("disk")) || !has_fs {
                continue;
            }

            let device = match part.get("path").and_then(|v| v.as_str()) {
                Some(p) => p.to_string(),
                None => continue,
            };

            let mountpoint = part
                .get("mountpoint")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(PathBuf::from);

            if mountpoint.as_deref().is_some_and(is_system_mount) {
                continue;
            }

            let label = part
                .get("label")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());

            return Some(Candidate { device, label, mountpoint });
        }
    }

    None
}

fn is_system_mount(mp: &Path) -> bool {
    let s = mp.to_string_lossy();
    s == "/" || s == "/boot" || s == "/boot/efi" || s.starts_with("/run/live")
}

fn mount(candidate: &Candidate) -> Result<UsbState, String> {
    if let Some(mp) = &candidate.mountpoint {
        return Ok(UsbState {
            device: candidate.device.clone(),
            mountpoint: mp.clone(),
            label: candidate.label.clone(),
            method: MountMethod::Premounted,
        });
    }

    if Path::new(MOUNT_HELPER).exists() {
        let out = Command::new("sudo")
            .args([MOUNT_HELPER, "mount", &candidate.device])
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            let mp = String::from_utf8_lossy(&out.stdout).trim().lines().last().unwrap_or("").trim().to_string();
            if !mp.is_empty() {
                return Ok(UsbState {
                    device: candidate.device.clone(),
                    mountpoint: PathBuf::from(mp),
                    label: candidate.label.clone(),
                    method: MountMethod::Helper,
                });
            }
        }
        return Err(format!("helper mount failed: {}", String::from_utf8_lossy(&out.stderr)));
    }

    let out = Command::new("udisksctl")
        .args(["mount", "-b", &candidate.device])
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        let text = String::from_utf8_lossy(&out.stdout);
        if let Some(idx) = text.find(" at ") {
            let mp = text[idx + 4..].trim().trim_end_matches('.').to_string();
            return Ok(UsbState {
                device: candidate.device.clone(),
                mountpoint: PathBuf::from(mp),
                label: candidate.label.clone(),
                method: MountMethod::Udisks,
            });
        }
    }
    Err(format!("udisksctl mount failed: {}", String::from_utf8_lossy(&out.stderr)))
}

fn unmount(state: &UsbState) {
    match state.method {
        MountMethod::Premounted => {}
        MountMethod::Helper => {
            let _ = Command::new("sudo").args([MOUNT_HELPER, "unmount"]).status();
        }
        MountMethod::Udisks => {
            let _ = Command::new("udisksctl").args(["unmount", "-b", &state.device]).status();
        }
    }
}
