use std::io::{Read, Write};
use std::os::unix::io::AsRawFd;
use std::os::unix::net::UnixStream;
use std::sync::Mutex;

use godot::classes::{IRefCounted, RefCounted};
use godot::global::Error;
use godot::prelude::*;

struct UnixSocketExtension;

#[gdextension(entry_symbol = unixsocket_library_init)]
unsafe impl ExtensionLibrary for UnixSocketExtension {}

#[derive(GodotClass)]
#[class(base=RefCounted)]
struct StreamPeerUnix {
    base: Base<RefCounted>,
    stream: Mutex<Option<UnixStream>>,
}

#[godot_api]
impl IRefCounted for StreamPeerUnix {
    fn init(base: Base<RefCounted>) -> Self {
        Self {
            base,
            stream: Mutex::new(None),
        }
    }
}

#[godot_api]
impl StreamPeerUnix {
    #[func]
    fn open(&self, path: GString) -> Error {
        match UnixStream::connect(path.to_string()) {
            Ok(s) => {
                let _ = s.set_nonblocking(false);
                *self.stream.lock().unwrap() = Some(s);
                Error::OK
            }
            Err(_) => Error::FAILED,
        }
    }

    #[func]
    fn is_open(&self) -> bool {
        self.stream.lock().unwrap().is_some()
    }

    #[func]
    fn close(&self) {
        *self.stream.lock().unwrap() = None;
    }

    #[func]
    fn put_data(&self, data: PackedByteArray) -> Error {
        let mut guard = self.stream.lock().unwrap();
        let Some(stream) = guard.as_ref() else {
            return Error::FAILED;
        };
        let mut w: &UnixStream = stream;
        match w.write_all(data.as_slice()) {
            Ok(()) => Error::OK,
            Err(_) => {
                *guard = None;
                Error::FAILED
            }
        }
    }

    #[func]
    fn get_available_bytes(&self) -> i32 {
        let guard = self.stream.lock().unwrap();
        let Some(stream) = guard.as_ref() else {
            return -1;
        };
        let mut available: libc::c_int = 0;
        let rc = unsafe { libc::ioctl(stream.as_raw_fd(), libc::FIONREAD, &mut available) };
        if rc < 0 {
            -1
        } else {
            available as i32
        }
    }

    #[func]
    fn get_data(&self, count: i32) -> Array<Variant> {
        if count <= 0 {
            return result_array(Error::OK, PackedByteArray::new());
        }
        let mut guard = self.stream.lock().unwrap();
        let Some(stream) = guard.as_ref() else {
            return result_array(Error::FAILED, PackedByteArray::new());
        };
        let mut buf = vec![0u8; count as usize];
        let mut r: &UnixStream = stream;
        match r.read_exact(&mut buf) {
            Ok(()) => result_array(Error::OK, PackedByteArray::from(buf.as_slice())),
            Err(_) => {
                *guard = None;
                result_array(Error::FAILED, PackedByteArray::new())
            }
        }
    }
}

fn result_array(err: Error, bytes: PackedByteArray) -> Array<Variant> {
    let mut arr: Array<Variant> = Array::new();
    arr.push(&err.to_variant());
    arr.push(&bytes.to_variant());
    arr
}
