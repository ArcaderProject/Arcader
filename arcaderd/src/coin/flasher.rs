use std::io::BufReader;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};

use regex::Regex;

use crate::coin::serial;
use crate::utils::paths::cwd;

const FIRMWARE_HEX_NAME: &str = "coin_acceptor.hex";
const FIRMWARE_VERSION_NAME: &str = "coin_acceptor.version";

fn firmware_dir() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = std::env::var("ARCADER_FIRMWARE_DIR") {
        candidates.push(PathBuf::from(dir));
    }
    candidates.push(cwd().join("firmware"));
    candidates.push(cwd().join("arcaderd").join("firmware"));
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("firmware"));
        }
    }
    candidates.push(PathBuf::from("/usr/share/arcader/firmware"));

    candidates.into_iter().find(|dir| dir.join(FIRMWARE_HEX_NAME).is_file())
}

pub fn firmware_hex_path() -> Option<PathBuf> {
    firmware_dir().map(|dir| dir.join(FIRMWARE_HEX_NAME))
}

pub fn bundled_version() -> Option<u32> {
    std::fs::read_to_string(firmware_dir()?.join(FIRMWARE_VERSION_NAME))
        .ok()?
        .trim()
        .parse()
        .ok()
}

pub fn handshake(port_name: &str) -> Option<u32> {
    let re = Regex::new(r"ARCADER_COIN v(\d+)").ok()?;
    let port = serial::open(port_name, Duration::from_millis(500)).ok()?;
    serial::wait_for_boot();

    let mut reader = BufReader::new(port);
    let _ = serial::send_command(reader.get_mut(), "VERSION?");

    let mut found = None;
    let deadline = Instant::now() + Duration::from_secs(3);
    let _ = serial::read_lines_until(&mut reader, deadline, |line| {
        if found.is_none() {
            if let Some(caps) = re.captures(line) {
                found = caps[1].parse().ok();
            }
        }
    });
    found
}

fn find_avrdude() -> Option<String> {
    if Command::new("avrdude").arg("-?").output().is_ok() {
        return Some("avrdude".to_string());
    }
    ["/usr/bin/avrdude", "/usr/local/bin/avrdude", "/bin/avrdude"]
        .into_iter()
        .find(|p| PathBuf::from(p).is_file())
        .map(String::from)
}

pub fn flash(port_name: &str) -> bool {
    let hex = match firmware_hex_path() {
        Some(path) => path,
        None => {
            eprintln!("[coin] No bundled firmware hex found; cannot flash");
            return false;
        }
    };
    let avrdude = match find_avrdude() {
        Some(path) => path,
        None => {
            eprintln!("[coin] avrdude not found; install it to enable auto-flashing");
            return false;
        }
    };
    let hex_arg = format!("flash:w:{}:i", hex.display());

    for baud in ["115200", "57600", "19200"] {
        println!("[coin] Flashing {} at {} baud...", port_name, baud);
        match Command::new(&avrdude)
            .args(["-q", "-c", "arduino", "-p", "atmega328p", "-P", port_name, "-b", baud, "-D", "-U", &hex_arg])
            .status()
        {
            Ok(s) if s.success() => {
                println!("[coin] Flash succeeded at {} baud", baud);
                return true;
            }
            Ok(s) => eprintln!("[coin] avrdude exited with {} at {} baud, retrying", s, baud),
            Err(error) => {
                eprintln!("[coin] Failed to run avrdude: {}", error);
                return false;
            }
        }
    }
    eprintln!("[coin] All flash attempts failed for {}", port_name);
    false
}

pub fn ensure_firmware(port_name: &str) -> bool {
    let expected = bundled_version();
    match (handshake(port_name), expected) {
        (Some(version), Some(expected)) if version >= expected => {
            println!("[coin] {} runs firmware v{} (expected v{}); skipping flash", port_name, version, expected);
            true
        }
        (Some(version), None) => {
            println!("[coin] {} runs firmware v{}; no bundled version, skipping flash", port_name, version);
            true
        }
        (Some(version), Some(expected)) => {
            println!("[coin] {} runs firmware v{}, bundled is v{}; reflashing", port_name, version, expected);
            flash(port_name)
        }
        (None, _) => {
            println!("[coin] No Arcader firmware on {}; flashing", port_name);
            flash(port_name)
        }
    }
}
