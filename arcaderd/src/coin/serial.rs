use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::time::{Duration, Instant};

use serialport::SerialPort;

pub const BAUD_RATE: u32 = 9600;

pub fn open(port_name: &str, read_timeout: Duration) -> serialport::Result<Box<dyn SerialPort>> {
    serialport::new(port_name, BAUD_RATE)
        .data_bits(serialport::DataBits::Eight)
        .parity(serialport::Parity::None)
        .stop_bits(serialport::StopBits::One)
        .flow_control(serialport::FlowControl::None)
        .timeout(read_timeout)
        .open()
}

pub fn read_lines_until<F>(
    reader: &mut BufReader<Box<dyn SerialPort>>,
    deadline: Instant,
    mut on_line: F,
) -> std::io::Result<()>
where
    F: FnMut(&str),
{
    while Instant::now() < deadline {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => {
                return Err(std::io::Error::new(
                    ErrorKind::UnexpectedEof,
                    "serial closed",
                ))
            }
            Ok(_) => {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    on_line(trimmed);
                }
            }
            Err(ref e) if e.kind() == ErrorKind::TimedOut || e.kind() == ErrorKind::Interrupted => {
            }
            Err(e) => return Err(e),
        }
    }
    Ok(())
}

pub fn send_command(port: &mut Box<dyn SerialPort>, command: &str) -> std::io::Result<()> {
    port.write_all(command.as_bytes())?;
    port.write_all(b"\n")?;
    port.flush()
}

pub fn wait_for_boot() {
    std::thread::sleep(Duration::from_millis(2000));
}
