use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

static CREDITS: AtomicU32 = AtomicU32::new(0);
static HARDWARE_CONNECTED: AtomicBool = AtomicBool::new(false);
static FREE_PLAY: AtomicBool = AtomicBool::new(false);

pub fn add(amount: u32) -> u32 {
    CREDITS.fetch_add(amount, Ordering::SeqCst) + amount
}

pub fn try_consume() -> bool {
    CREDITS
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |c| {
            if c == 0 {
                None
            } else {
                Some(c - 1)
            }
        })
        .is_ok()
}

pub fn get() -> u32 {
    CREDITS.load(Ordering::SeqCst)
}

pub fn set_hardware_connected(connected: bool) {
    HARDWARE_CONNECTED.store(connected, Ordering::SeqCst);
}

pub fn is_hardware_connected() -> bool {
    HARDWARE_CONNECTED.load(Ordering::SeqCst)
}

pub fn set_free_play(enabled: bool) {
    FREE_PLAY.store(enabled, Ordering::SeqCst);
}

pub fn is_free_play() -> bool {
    FREE_PLAY.load(Ordering::SeqCst)
}
