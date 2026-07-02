use crate::utils::config::get_config;

pub fn set_volume(percent: i64) {
    let percent = percent.clamp(0, 100);

    let _ = std::process::Command::new("pactl")
        .args(["set-sink-mute", "@DEFAULT_SINK@", "0"])
        .status();
    let _ = std::process::Command::new("pactl")
        .args(["set-sink-volume", "@DEFAULT_SINK@", &format!("{}%", percent)])
        .status();
}

pub fn apply_saved_volume() {
    if let Some(value) = get_config("audio.volume", None) {
        if let Ok(percent) = value.parse::<i64>() {
            set_volume(percent);
        }
    }
}
