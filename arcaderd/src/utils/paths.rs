use std::path::PathBuf;

pub fn cwd() -> PathBuf {
    std::env::current_dir().expect("Failed to read current working directory")
}
