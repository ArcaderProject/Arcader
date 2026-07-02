use std::fs;
use std::path::{Path, PathBuf};

use crate::utils::download::get_system_architecture;

pub fn get_retro_arch_app_image_name() -> String {
    get_retro_arch_app_image_name_for(&get_system_architecture())
}

pub fn get_retro_arch_app_image_name_for(arch: &str) -> String {
    format!("RetroArch-Linux-{}.AppImage", arch)
}

pub fn get_retro_arch_home_dir_name() -> String {
    get_retro_arch_home_dir_name_for(&get_system_architecture())
}

pub fn get_retro_arch_home_dir_name_for(arch: &str) -> String {
    format!("RetroArch-Linux-{}.AppImage.home", arch)
}

pub fn ensure_directory_exists(dir_path: &Path) {
    if !dir_path.exists() {
        fs::create_dir_all(dir_path).unwrap();
    }
}

pub struct DataDirectories {
    pub retroarch_dir: PathBuf,
    pub cores_dir: PathBuf,
}

pub fn ensure_data_directories(working_dir: &Path) -> DataDirectories {
    let data_dir = working_dir.join("data");
    let retroarch_dir = data_dir.join("retroarch");
    let cores_dir = data_dir.join("cores");
    let roms_dir = data_dir.join("roms");
    let covers_dir = data_dir.join("covers");

    ensure_directory_exists(&data_dir);
    ensure_directory_exists(&retroarch_dir);
    ensure_directory_exists(&cores_dir);
    ensure_directory_exists(&roms_dir);
    ensure_directory_exists(&covers_dir);

    DataDirectories {
        retroarch_dir,
        cores_dir,
    }
}

pub fn ensure_executable(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        if let Ok(metadata) = fs::metadata(path) {
            let mut perms = metadata.permissions();
            let mode = perms.mode();
            let desired = mode | ((mode & 0o444) >> 2);
            if desired != mode {
                perms.set_mode(desired);
                let _ = fs::set_permissions(path, perms);
            }
        }
    }
    #[cfg(not(unix))]
    let _ = path;
}

pub fn is_retro_arch_installed() -> bool {
    let retroarch_dir = Path::new(".").join("data").join("retroarch");
    let retroarch_app_image = retroarch_dir.join(get_retro_arch_app_image_name());

    retroarch_app_image.exists()
}

pub fn are_cores_installed(cores_dir: &Path) -> bool {
    if !cores_dir.exists() {
        return false;
    }

    let core_files = fs::read_dir(cores_dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter(|e| {
                    e.file_name()
                        .to_string_lossy()
                        .ends_with("_libretro.so")
                })
                .count()
        })
        .unwrap_or(0);

    core_files > 0
}

pub fn move_directory_contents(source_dir: &Path, target_dir: &Path) {
    let items = fs::read_dir(source_dir).unwrap();

    for item in items.filter_map(Result::ok) {
        let source_path = item.path();
        let target_path = target_dir.join(item.file_name());

        fs::rename(&source_path, &target_path).unwrap();
    }

    fs::remove_dir(source_dir).unwrap();
}
