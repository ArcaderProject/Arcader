use std::time::Duration;

use crate::tasks::TaskResult;
use crate::utils::directory::{
    ensure_data_directories, is_retro_arch_installed, move_directory_contents,
};
use crate::utils::download::{
    build_retro_arch_url, download_file, extract_7z, get_system_architecture, wait_for_internet,
    RETROARCH_VERSION,
};
use crate::utils::paths::cwd;

pub async fn ensure_retro_arch() -> Result<(), String> {
    let dirs = ensure_data_directories(&cwd());
    let retroarch_dir = dirs.retroarch_dir;

    if is_retro_arch_installed() {
        println!("RetroArch already installed");
        return Ok(());
    }

    println!("RetroArch not found, downloading...");

    let has_internet = wait_for_internet(30, Duration::from_millis(10000)).await;
    if !has_internet {
        return Err(
            "No internet connection available. RetroArch will be downloaded when internet is restored."
                .to_string(),
        );
    }

    let download_url = build_retro_arch_url(RETROARCH_VERSION, &get_system_architecture());
    let archive_path = retroarch_dir.join("RetroArch.7z");

    download_file(&download_url, &archive_path).await?;
    extract_7z(&archive_path, &retroarch_dir)?;

    let extracted_sub_dir =
        retroarch_dir.join(format!("RetroArch-Linux-{}", get_system_architecture()));
    if extracted_sub_dir.exists() {
        move_directory_contents(&extracted_sub_dir, &retroarch_dir);
        println!("Moved RetroArch files to retroarch directory");
    }

    if is_retro_arch_installed() {
        println!("RetroArch setup completed");
        Ok(())
    } else {
        Err("RetroArch installation verification failed".to_string())
    }
}

pub async fn run_retro_arch_task() -> TaskResult {
    match ensure_retro_arch().await {
        Ok(()) => TaskResult {
            success: true,
            message: "RetroArch setup completed".to_string(),
        },
        Err(message) => {
            eprintln!("RetroArch setup failed: {}", message);
            TaskResult {
                success: false,
                message,
            }
        }
    }
}
