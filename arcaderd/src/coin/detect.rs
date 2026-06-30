use std::path::Path;

use serialport::{SerialPortType, UsbPortInfo};

#[derive(Clone, Debug)]
pub struct DetectedBoard {
    pub port_name: String,
    pub vid: u16,
    pub pid: u16,
}

fn is_known_vendor(vid: u16) -> bool {
    matches!(
        vid,
        0x2341 | 0x2A03 | 0x1B4F | 0x239A | 0x1A86 | 0x0403 | 0x10C4 | 0x067B
    )
}

pub fn find_candidate_boards() -> Vec<DetectedBoard> {
    let mut boards: Vec<DetectedBoard> = serialport::available_ports()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|port| match port.port_type {
            SerialPortType::UsbPort(UsbPortInfo { vid, pid, .. }) if is_known_vendor(vid) => {
                Some(DetectedBoard { port_name: port.port_name, vid, pid })
            }
            _ => None,
        })
        .collect();

    if boards.is_empty() {
        boards = scan_sysfs();
    }

    boards.sort_by_key(|b| (if b.vid == 0x2341 { 0 } else { 1 }, b.port_name.clone()));
    boards
}

fn read_hex_u16(path: &Path) -> Option<u16> {
    u16::from_str_radix(std::fs::read_to_string(path).ok()?.trim(), 16).ok()
}

fn usb_ids_for_tty(dev_name: &str) -> Option<(u16, u16)> {
    let mut dir = Path::new("/sys/class/tty")
        .join(dev_name)
        .join("device")
        .canonicalize()
        .ok()?;

    for _ in 0..6 {
        if let (Some(vid), Some(pid)) =
            (read_hex_u16(&dir.join("idVendor")), read_hex_u16(&dir.join("idProduct")))
        {
            return Some((vid, pid));
        }
        dir = dir.parent()?.to_path_buf();
    }
    None
}

fn scan_sysfs() -> Vec<DetectedBoard> {
    let entries = match std::fs::read_dir("/sys/class/tty") {
        Ok(entries) => entries,
        Err(_) => return Vec::new(),
    };

    entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if !(name.starts_with("ttyACM") || name.starts_with("ttyUSB")) {
                return None;
            }
            let port_name = format!("/dev/{}", name);
            if !Path::new(&port_name).exists() {
                return None;
            }
            let (vid, pid) = usb_ids_for_tty(&name)?;
            is_known_vendor(vid).then_some(DetectedBoard { port_name, vid, pid })
        })
        .collect()
}
