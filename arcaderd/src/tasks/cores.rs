use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::tasks::TaskResult;
use crate::utils::directory::{are_cores_installed, ensure_data_directories, is_retro_arch_installed};
use crate::utils::download::{
    build_retro_arch_cores_url, download_file, extract_7z, get_system_architecture,
    wait_for_clock_sync, wait_for_internet, RETROARCH_VERSION,
};
use crate::utils::paths::cwd;

struct CoresVerification {
    success: bool,
    message: String,
    #[allow(dead_code)]
    core_count: usize,
    #[allow(dead_code)]
    info_count: usize,
}

fn verify_cores_installation(cores_dir: &Path) -> CoresVerification {
    if !cores_dir.exists() {
        return CoresVerification {
            success: false,
            message: "Cores directory does not exist".to_string(),
            core_count: 0,
            info_count: 0,
        };
    }

    let files: Vec<String> = fs::read_dir(cores_dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default();

    let core_count = files.iter().filter(|f| f.ends_with("_libretro.so")).count();
    let info_count = files.iter().filter(|f| f.ends_with("_libretro.info")).count();

    let success = core_count > 0;

    CoresVerification {
        success,
        message: if success {
            format!(
                "Found {} core libraries and {} info files",
                core_count, info_count
            )
        } else {
            format!(
                "Installation incomplete: {} cores, {} info files",
                core_count, info_count
            )
        },
        core_count,
        info_count,
    }
}

fn cleanup_archive(archive_path: &Path) {
    if archive_path.exists() {
        fs::remove_file(archive_path).unwrap();
        println!("Archive cleaned up");
    }
}

fn find_cores_directory(dir: &Path) -> Option<PathBuf> {
    if !dir.exists() || !dir.is_dir() {
        return None;
    }

    let items: Vec<_> = match fs::read_dir(dir) {
        Ok(e) => e.filter_map(Result::ok).collect(),
        Err(_) => return None,
    };

    if items
        .iter()
        .any(|item| item.file_name().to_string_lossy().ends_with("_libretro.so"))
    {
        return Some(dir.to_path_buf());
    }

    for item in &items {
        let item_path = item.path();
        if item_path.is_dir() {
            if let Some(found) = find_cores_directory(&item_path) {
                return Some(found);
            }
        }
    }

    None
}

fn extract_cores(archive_path: &Path, cores_dir: &Path) -> Result<(), String> {
    let temp_extract_dir = cores_dir
        .parent()
        .unwrap_or(cores_dir)
        .join("temp_cores_extract");

    let result = (|| -> Result<(), String> {
        extract_7z(archive_path, &temp_extract_dir)?;

        if !cores_dir.exists() {
            fs::create_dir_all(cores_dir).map_err(|e| e.to_string())?;
            println!("Created cores directory");
        }

        let source_cores_dir = find_cores_directory(&temp_extract_dir)
            .ok_or_else(|| "Could not find cores directory in extracted archive".to_string())?;

        let core_files = fs::read_dir(&source_cores_dir).map_err(|e| e.to_string())?;
        let mut copied_cores = 0;

        for entry in core_files.filter_map(Result::ok) {
            let file = entry.file_name().to_string_lossy().into_owned();
            if file.ends_with("_libretro.so") || file.ends_with("_libretro.info") {
                let source_path = source_cores_dir.join(&file);
                let target_path = cores_dir.join(&file);

                fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;
                if file.ends_with(".so") {
                    copied_cores += 1;
                }
            }
        }

        println!(
            "Copied {} core libraries to {}",
            copied_cores,
            cores_dir.display()
        );

        if temp_extract_dir.exists() {
            let _ = fs::remove_dir_all(&temp_extract_dir);
        }

        Ok(())
    })();

    if result.is_err() && temp_extract_dir.exists() {
        let _ = fs::remove_dir_all(&temp_extract_dir);
    }

    result
}

pub async fn ensure_retro_arch_cores() -> TaskResult {
    let dirs = ensure_data_directories(&cwd());
    let retroarch_dir = dirs.retroarch_dir;
    let cores_dir = dirs.cores_dir;

    if !is_retro_arch_installed() {
        return TaskResult {
            success: false,
            message: "RetroArch must be installed before installing cores".to_string(),
        };
    }

    if are_cores_installed(&cores_dir) {
        let _verification = verify_cores_installation(&cores_dir);
        println!("RetroArch cores already installed");
        return TaskResult {
            success: true,
            message: "Cores already installed".to_string(),
        };
    }

    println!("RetroArch cores not found, downloading...");

    let has_internet = wait_for_internet(30, Duration::from_millis(10000)).await;
    if !has_internet {
        return TaskResult {
            success: false,
            message:
                "No internet connection available. Cores will be downloaded when internet is restored."
                    .to_string(),
        };
    }

    wait_for_clock_sync(30, Duration::from_secs(2)).await;

    let download_url = build_retro_arch_cores_url(RETROARCH_VERSION, &get_system_architecture());
    let archive_path = retroarch_dir.join("RetroArch_cores.7z");

    match run_cores_install(&download_url, &archive_path, &cores_dir).await {
        Ok(message) => {
            println!("RetroArch cores setup completed successfully");
            TaskResult {
                success: true,
                message,
            }
        }
        Err(message) => {
            eprintln!("RetroArch cores setup failed: {}", message);
            TaskResult {
                success: false,
                message,
            }
        }
    }
}

async fn run_cores_install(
    download_url: &str,
    archive_path: &Path,
    cores_dir: &Path,
) -> Result<String, String> {
    if let Err(e) = download_file(download_url, archive_path).await {
        cleanup_archive(archive_path);
        return Err(format!("Failed to download cores: {}", e));
    }

    if !archive_path.exists() {
        return Err("Downloaded archive file not found".to_string());
    }

    let stats = fs::metadata(archive_path).map_err(|e| e.to_string())?;
    if stats.len() == 0 {
        cleanup_archive(archive_path);
        return Err("Downloaded archive is empty".to_string());
    }

    println!(
        "Archive downloaded successfully ({:.2} MB)",
        stats.len() as f64 / (1024.0 * 1024.0)
    );

    if let Err(e) = extract_cores(archive_path, cores_dir) {
        cleanup_archive(archive_path);
        return Err(format!("Failed to extract cores: {}", e));
    }

    cleanup_archive(archive_path);

    let verification = verify_cores_installation(cores_dir);

    if !verification.success {
        return Err(verification.message);
    }

    Ok("Cores installed successfully".to_string())
}

pub async fn run_cores_task() -> TaskResult {
    ensure_retro_arch_cores().await
}
