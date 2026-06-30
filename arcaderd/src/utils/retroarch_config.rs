use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use once_cell::sync::Lazy;
use regex::Regex;

use crate::utils::directory::get_retro_arch_home_dir_name;
use crate::utils::paths::cwd;

fn retroarch_config_path() -> PathBuf {
    cwd().join("data/retroarch").join(format!(
        "{}/.config/retroarch/retroarch.cfg",
        get_retro_arch_home_dir_name()
    ))
}

static KEY_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^([a-zA-Z0-9_]+)\s*=").unwrap());

pub fn apply_retro_arch_config_overrides(overrides: &HashMap<String, String>) {
    if overrides.is_empty() {
        return;
    }

    let config_path = retroarch_config_path();

    if !config_path.exists() {
        eprintln!(
            "RetroArch config file not found: {}",
            config_path.display()
        );
        return;
    }

    let content = match fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to apply RetroArch config overrides: {}", e);
            return;
        }
    };

    let lines: Vec<&str> = content.split('\n').collect();
    let mut modified_lines: Vec<String> = Vec::new();
    let mut applied_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

    for line in &lines {
        let trimmed = line.trim();

        if let Some(caps) = KEY_RE.captures(trimmed) {
            let key = caps.get(1).unwrap().as_str();
            if let Some(value) = overrides.get(key) {
                modified_lines.push(format!("{} = \"{}\"", key, value));
                applied_keys.insert(key.to_string());
                continue;
            }
        }
        modified_lines.push(line.to_string());
    }

    for (key, value) in overrides {
        if !applied_keys.contains(key) {
            modified_lines.push(format!("{} = \"{}\"", key, value));
        }
    }

    if let Err(e) = fs::write(&config_path, modified_lines.join("\n")) {
        eprintln!("Failed to apply RetroArch config overrides: {}", e);
        return;
    }

    let keys: Vec<&str> = overrides.keys().map(|s| s.as_str()).collect();
    println!(
        "Applied RetroArch config overrides: {}",
        keys.join(", ")
    );
}
