use std::io::{BufRead, BufReader, ErrorKind};
use std::time::{Duration, Instant};

use crate::coin::serial;
use crate::coin::{broadcast_coin_inserted, broadcast_coin_status, credits};

const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(8);

pub fn run(port_name: &str) {
    let port = match serial::open(port_name, Duration::from_millis(500)) {
        Ok(port) => port,
        Err(error) => {
            eprintln!("[coin] Reader could not open {}: {}", port_name, error);
            return;
        }
    };
    serial::wait_for_boot();

    credits::set_hardware_connected(true);
    broadcast_coin_status();
    println!("[coin] Listening for coins on {}", port_name);

    let mut reader = BufReader::new(port);
    let mut last_activity = Instant::now();

    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => {
                eprintln!("[coin] {} closed the connection", port_name);
                break;
            }
            Ok(_) => {
                last_activity = Instant::now();
                handle_line(line.trim());
            }
            Err(ref e) if e.kind() == ErrorKind::TimedOut => {
                if last_activity.elapsed() > HEARTBEAT_TIMEOUT {
                    eprintln!("[coin] No heartbeat from {}; reconnecting", port_name);
                    break;
                }
            }
            Err(ref e) if e.kind() == ErrorKind::Interrupted => {}
            Err(error) => {
                eprintln!("[coin] Read error on {}: {}", port_name, error);
                break;
            }
        }
    }

    credits::set_hardware_connected(false);
    broadcast_coin_status();
}

fn handle_line(line: &str) {
    match line {
        "COIN" => {
            let total = credits::add(1);
            println!("[coin] Coin inserted; credits now {}", total);
            broadcast_coin_inserted(total);
        }
        "HB" => {
            if !credits::is_hardware_connected() {
                credits::set_hardware_connected(true);
                broadcast_coin_status();
            }
        }
        _ if line.starts_with("CAL ") => println!("[coin] Calibrated coin pin: {}", &line[4..]),
        _ => {}
    }
}
