use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::utils::paths::cwd;

pub const BACKUP_DIR: &str = "ARCADER_BACKUP";
pub const FORMAT_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug)]
pub struct Categories {
    pub games: bool,
    pub saves: bool,
    pub lists: bool,
    pub settings: bool,
}

impl Categories {
    pub fn from_list(items: &[String]) -> Self {
        let has = |names: &[&str]| {
            items
                .iter()
                .any(|s| names.iter().any(|n| s.eq_ignore_ascii_case(n)))
        };

        if has(&["all"]) {
            return Categories {
                games: true,
                saves: true,
                lists: true,
                settings: true,
            };
        }

        Categories {
            games: has(&["games", "game"]),
            saves: has(&["saves", "savestates", "savestate", "save"]),
            lists: has(&["lists", "list"]),
            settings: has(&["settings", "arcader", "arcader_settings", "config"]),
        }
    }

    pub fn any(&self) -> bool {
        self.games || self.saves || self.lists || self.settings
    }

    pub fn needs_game_map(&self) -> bool {
        self.games || self.saves || self.lists
    }
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
pub struct Contents {
    #[serde(default)]
    pub games: usize,
    #[serde(default)]
    pub saves: usize,
    #[serde(default)]
    pub lists: usize,
    #[serde(default)]
    pub settings: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Manifest {
    pub version: u32,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub contents: Contents,
}

pub fn backup_root(mountpoint: &Path) -> PathBuf {
    mountpoint.join(BACKUP_DIR)
}

pub fn manifest_path(mountpoint: &Path) -> PathBuf {
    backup_root(mountpoint).join("manifest.json")
}

pub fn backup_games_dir(mountpoint: &Path) -> PathBuf {
    backup_root(mountpoint).join("games")
}

pub fn backup_lists_path(mountpoint: &Path) -> PathBuf {
    backup_root(mountpoint).join("lists").join("lists.json")
}

pub fn backup_saves_dir(mountpoint: &Path) -> PathBuf {
    backup_root(mountpoint).join("saves")
}

pub fn backup_folders_path(mountpoint: &Path) -> PathBuf {
    backup_saves_dir(mountpoint).join("folders.json")
}

pub fn backup_settings_path(mountpoint: &Path) -> PathBuf {
    backup_root(mountpoint).join("settings").join("config.json")
}

pub fn data_root() -> PathBuf {
    cwd().join("data")
}

pub fn local_roms_dir() -> PathBuf {
    data_root().join("roms")
}

pub fn local_covers_dir() -> PathBuf {
    data_root().join("covers")
}

pub fn local_saves_dir() -> PathBuf {
    data_root().join("saves")
}

fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

pub fn sha256_file(path: &Path) -> io::Result<String> {
    use sha2::{Digest, Sha256};

    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    io::copy(&mut file, &mut hasher)?;
    Ok(to_hex(&hasher.finalize()))
}

pub fn random_hex_id() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    to_hex(&bytes)
}

pub fn walk_files(dir: &Path, base: &Path, out: &mut Vec<(String, PathBuf)>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            walk_files(&path, base, out);
        } else if path.is_file() {
            if let Ok(rel) = path.strip_prefix(base) {
                out.push((rel.to_string_lossy().replace('\\', "/"), path.clone()));
            }
        }
    }
}

pub fn read_manifest(mountpoint: &Path) -> Option<Manifest> {
    let raw = fs::read_to_string(manifest_path(mountpoint)).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn write_manifest(mountpoint: &Path, manifest: &Manifest) -> Result<(), String> {
    let json = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    fs::write(manifest_path(mountpoint), json).map_err(|e| e.to_string())
}
