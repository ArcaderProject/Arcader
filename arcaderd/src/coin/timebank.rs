use std::sync::atomic::{AtomicI64, Ordering};

static REMAINING_SECONDS: AtomicI64 = AtomicI64::new(0);

pub fn add_seconds(seconds: i64) -> i64 {
    (REMAINING_SECONDS.fetch_add(seconds, Ordering::SeqCst) + seconds).max(0)
}

pub fn get() -> i64 {
    REMAINING_SECONDS.load(Ordering::SeqCst).max(0)
}

pub fn tick(seconds: i64) -> i64 {
    REMAINING_SECONDS
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |v| Some((v - seconds).max(0)))
        .unwrap_or(0);
    get()
}
