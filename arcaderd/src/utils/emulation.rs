use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};

use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::daemon::handlers::start_game::broadcast_update_screen;
use crate::utils::directory::{get_retro_arch_app_image_name, get_retro_arch_home_dir_name};
use crate::utils::game_saves::{get_active_save_folder, get_save_folder_path};
use crate::utils::paths::cwd;
use crate::utils::retroarch_config::apply_retro_arch_config_overrides;

#[derive(Clone, Serialize)]
pub struct Core {
    pub display_name: String,
    pub core: String,
    pub extensions: Vec<String>,
    pub systemname: String,
    pub corename: String,
}

static CURRENT_PID: Lazy<std::sync::Mutex<Option<i32>>> =
    Lazy::new(|| std::sync::Mutex::new(None));
static CURRENT_GAME: Lazy<std::sync::Mutex<Option<Value>>> =
    Lazy::new(|| std::sync::Mutex::new(None));
static CURRENT_TEMP_SAVE_FOLDER: Lazy<std::sync::Mutex<Option<String>>> =
    Lazy::new(|| std::sync::Mutex::new(None));
static CORES: Lazy<std::sync::Mutex<Vec<Core>>> = Lazy::new(|| std::sync::Mutex::new(Vec::new()));

static INFO_LINE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new("^(\\w+)\\s*=\\s*\"(.+)\"$").unwrap());

fn parse_info_file(file_path: &Path) -> Option<HashMap<String, String>> {
    let content = match fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error parsing info file {}: {}", file_path.display(), e);
            return None;
        }
    };

    let mut data = HashMap::new();

    for line in content.split('\n') {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }

        if let Some(caps) = INFO_LINE_RE.captures(line) {
            data.insert(caps[1].to_string(), caps[2].to_string());
        }
    }

    Some(data)
}

fn load_cores_data() -> Vec<Core> {
    let cores_info_path = cwd().join(format!(
        "data/retroarch/{}/.config/retroarch/cores",
        get_retro_arch_home_dir_name()
    ));

    if !cores_info_path.exists() {
        eprintln!(
            "RetroArch cores info directory not found: {}",
            cores_info_path.display()
        );
        return Vec::new();
    }

    let cores_dir = cwd().join("data/cores");
    let entries = match fs::read_dir(&cores_info_path) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("Error loading cores metadata: {}", e);
            return Vec::new();
        }
    };

    let mut cores_data = Vec::new();

    for entry in entries.filter_map(Result::ok) {
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if !file_name.ends_with("_libretro.info") {
            continue;
        }

        let info_path = entry.path();
        let data = match parse_info_file(&info_path) {
            Some(d) => d,
            None => continue,
        };

        let display_name = data.get("display_name");
        let supported_extensions = data.get("supported_extensions");

        if let (Some(display_name), Some(supported_extensions)) =
            (display_name, supported_extensions)
        {
            let core_name = file_name.replace("_libretro.info", "_libretro.so");
            let core_file_path = cores_dir.join(&core_name);

            if !core_file_path.exists() {
                continue;
            }

            let extensions: Vec<String> = supported_extensions
                .split(|c| c == '|' || c == ',')
                .map(|ext| ext.trim().to_string())
                .filter(|ext| !ext.is_empty())
                .collect();

            cores_data.push(Core {
                display_name: display_name.clone(),
                core: core_name,
                extensions,
                systemname: data.get("systemname").cloned().unwrap_or_default(),
                corename: data.get("corename").cloned().unwrap_or_default(),
            });
        }
    }

    println!(
        "Loaded {} cores from RetroArch info files",
        cores_data.len()
    );
    cores_data
}

fn is_running(pid: i32) -> bool {
    nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None).is_ok()
}

pub fn reload_cores() -> Vec<Core> {
    let cores = load_cores_data();
    *CORES.lock().unwrap() = cores.clone();
    cores
}

pub fn find_core_by_extension(ext: &str, preferred_core: Option<&str>) -> Option<Core> {
    let cores = CORES.lock().unwrap();

    if let Some(preferred) = preferred_core {
        if let Some(core) = cores
            .iter()
            .find(|c| c.core == preferred && c.extensions.iter().any(|e| e == ext))
        {
            return Some(core.clone());
        }
    }

    let matching_cores: Vec<&Core> = cores
        .iter()
        .filter(|core| core.extensions.iter().any(|e| e == ext))
        .collect();

    if matching_cores.is_empty() {
        return None;
    }

    let emulation_cores: Vec<&Core> = matching_cores
        .iter()
        .copied()
        .filter(|core| {
            let lower = core.display_name.to_lowercase();
            !lower.contains("utility") && !lower.contains("debug")
        })
        .collect();

    let cores_to_choose_from = if !emulation_cores.is_empty() {
        emulation_cores
    } else {
        matching_cores
    };

    let mut sorted = cores_to_choose_from;
    sorted.sort_by(|a, b| a.extensions.len().cmp(&b.extensions.len()));
    sorted.first().map(|c| (*c).clone())
}

pub fn get_cores_for_extension(ext: &str) -> Vec<Core> {
    let cores = CORES.lock().unwrap();
    cores
        .iter()
        .filter(|core| core.extensions.iter().any(|e| e == ext))
        .cloned()
        .collect()
}

fn is_wayland() -> bool {
    std::env::var("XDG_SESSION_TYPE").as_deref() == Ok("wayland")
}

fn wayland_lib_arch() -> &'static str {
    if std::env::consts::ARCH == "x86_64" {
        "x86_64"
    } else {
        "i386"
    }
}

fn copy_dir_recursive(src: &Path, dest: &Path) {
    if !dest.exists() {
        fs::create_dir_all(dest).unwrap();
    }

    let entries = match fs::read_dir(src) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.filter_map(Result::ok) {
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if entry.path().is_dir() {
            copy_dir_recursive(&src_path, &dest_path);
        } else {
            let _ = fs::copy(&src_path, &dest_path);
        }
    }
}

fn create_temp_save_folder(source_path: &Path, folder_name: &str) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = cwd()
        .join("data")
        .join("temp_saves")
        .join(format!("temp_{}", millis));

    println!(
        "[createTempSaveFolder] Creating temp folder for \"{}\"",
        folder_name
    );
    println!(
        "[createTempSaveFolder] Source path: {}",
        source_path.display()
    );
    println!("[createTempSaveFolder] Temp path: {}", temp_path.display());

    match fs::create_dir_all(&temp_path) {
        Ok(()) => {
            println!(
                "[createTempSaveFolder] Created temp directory: {}",
                temp_path.display()
            );

            if source_path.exists() {
                println!("[createTempSaveFolder] Source exists, copying files...");
                copy_dir_recursive(source_path, &temp_path);
                println!("[createTempSaveFolder] Successfully copied files to temporary folder");
            } else {
                println!("[createTempSaveFolder] Source folder doesn't exist yet, created empty temp folder");
            }

            temp_path
        }
        Err(e) => {
            eprintln!(
                "[createTempSaveFolder] Failed to create temporary save folder: {}",
                e
            );
            source_path.to_path_buf()
        }
    }
}

fn cleanup_temp_save_folder(temp_path: &str) {
    if !temp_path.contains("temp_saves") {
        return;
    }

    let path = Path::new(temp_path);
    if path.exists() {
        match fs::remove_dir_all(path) {
            Ok(()) => println!("Cleaned up temporary save folder: {}", temp_path),
            Err(e) => eprintln!("Failed to cleanup temporary save folder: {}", e),
        }
    }
}

pub fn start_emulator(core: &str, game_file: &str, game_info: Option<Value>) -> bool {
    let mut config_overrides: HashMap<String, String> = HashMap::new();

    config_overrides.insert("video_fullscreen".to_string(), "true".to_string());
    config_overrides.insert("video_windowed_fullscreen".to_string(), "true".to_string());

    if let Some(active_save_folder) = get_active_save_folder() {
        let mut save_path = get_save_folder_path(&active_save_folder.uuid);

        if active_save_folder.is_locked {
            let temp_path = create_temp_save_folder(&save_path, &active_save_folder.name);
            *CURRENT_TEMP_SAVE_FOLDER.lock().unwrap() =
                Some(temp_path.to_string_lossy().into_owned());
            save_path = temp_path;
        } else {
            *CURRENT_TEMP_SAVE_FOLDER.lock().unwrap() = None;
        }

        let save_path_str = save_path.to_string_lossy().into_owned();
        config_overrides.insert("savefile_directory".to_string(), save_path_str.clone());
        config_overrides.insert("savestate_directory".to_string(), save_path_str);
    }

    for key in [
        "notification_show_autoconfig",
        "notification_show_autoconfig_fails",
        "notification_show_cheats_applied",
        "notification_show_config_override_load",
        "notification_show_disk_control",
        "notification_show_fast_forward",
        "notification_show_netplay_extra",
        "notification_show_patch_applied",
        "notification_show_refresh_rate",
        "notification_show_remap_load",
        "notification_show_save_state",
        "notification_show_screenshot",
        "notification_show_set_initial_disk",
        "notification_show_when_menu_is_alive",
        "menu_show_load_content",
        "menu_show_load_core",
        "menu_show_online_updater",
        "menu_show_core_updater",
        "menu_show_configurations",
    ] {
        config_overrides.insert(key.to_string(), "false".to_string());
    }

    if !config_overrides.is_empty() {
        apply_retro_arch_config_overrides(&config_overrides);
    }

    let retroarch_path = cwd()
        .join("data")
        .join("retroarch")
        .join(get_retro_arch_app_image_name());
    let cores_path = cwd().join("data").join("cores").join(core);

    {
        let current = *CURRENT_PID.lock().unwrap();
        if let Some(pid) = current {
            if is_running(pid) {
                eprintln!("Emulator already running");
                return false;
            }
        }
    }

    println!(
        "Spawning emulator: {} -f -L {} {}",
        retroarch_path.display(),
        cores_path.display(),
        game_file
    );

    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
    let xauthority = std::env::var("XAUTHORITY").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_default();
        format!("{}/.Xauthority", home)
    });

    let mut command = tokio::process::Command::new(&retroarch_path);
    command
        .arg("-f")
        .arg("-L")
        .arg(&cores_path)
        .arg(game_file)
        .env("DISPLAY", display)
        .env("XAUTHORITY", xauthority)
        .process_group(0)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if is_wayland() {
        command.env(
            "LD_PRELOAD",
            format!(
                "/usr/lib/{}-linux-gnu/libwayland-client.so.0",
                wayland_lib_arch()
            ),
        );
    }

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to spawn emulator: {}", e);
            return false;
        }
    };

    let pid = child.id().map(|p| p as i32);

    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                println!("{}", line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("{}", line);
            }
        });
    }

    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.ok().and_then(|s| s.code());
        match code {
            Some(c) => println!("Emulator exited with code {}", c),
            None => println!("Emulator exited with code null"),
        }
        stop();
        crate::coin::notify_game_stopped();
        broadcast_screen(post_game_screen());
    });

    *CURRENT_PID.lock().unwrap() = pid;
    *CURRENT_GAME.lock().unwrap() = game_info;

    crate::coin::notify_game_started();
    broadcast_screen("LOADING");

    true
}

fn broadcast_screen(screen: &str) {
    broadcast_update_screen(screen);
}

fn post_game_screen() -> &'static str {
    if !crate::coin::coin_slot_enabled() || crate::coin::credits::is_free_play() {
        return "SELECTION";
    }
    let exhausted = if crate::coin::time_mode_enabled() {
        crate::coin::timebank::get() <= 0
    } else {
        crate::coin::credits::get() == 0
    };
    if exhausted {
        "COIN"
    } else {
        "SELECTION"
    }
}

pub fn start(game_file: &str, game_info: Option<Value>) -> bool {
    let ext = game_file.rsplit('.').next().unwrap_or("").to_string();

    let preferred = game_info
        .as_ref()
        .and_then(|g| g.get("core"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    let core = match preferred {
        Some(ref c) => find_core_by_extension(&ext, Some(c)),
        None => find_core_by_extension(&ext, None),
    };

    let core = match core {
        Some(c) => c,
        None => {
            eprintln!("No core found for this file extension");
            return false;
        }
    };

    println!(
        "Selected core: {} ({}) for extension .{}",
        core.display_name, core.core, ext
    );

    start_emulator(&core.core, game_file, game_info)
}

pub fn start_by_filename(filename: &str, game_info: Option<Value>) -> bool {
    let rom_path = cwd().join("data").join("roms").join(filename);

    if !rom_path.exists() {
        eprintln!("Game file not found");
        return false;
    }

    start(&rom_path.to_string_lossy(), game_info)
}

pub fn stop() -> bool {
    let current = *CURRENT_PID.lock().unwrap();
    if let Some(pid) = current {
        if is_running(pid) {
            match nix::sys::signal::killpg(
                nix::unistd::Pid::from_raw(pid),
                nix::sys::signal::Signal::SIGTERM,
            ) {
                Ok(()) => println!("Emulator closed"),
                Err(e) => eprintln!("Failed to terminate emulator: {}", e),
            }
        }
    }

    let temp = CURRENT_TEMP_SAVE_FOLDER.lock().unwrap().clone();
    if let Some(temp_path) = temp {
        cleanup_temp_save_folder(&temp_path);
        *CURRENT_TEMP_SAVE_FOLDER.lock().unwrap() = None;
    }

    *CURRENT_PID.lock().unwrap() = None;
    *CURRENT_GAME.lock().unwrap() = None;

    true
}

pub fn get_current_game() -> Option<Value> {
    CURRENT_GAME.lock().unwrap().clone()
}
