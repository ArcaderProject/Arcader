use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use flate2::read::GzDecoder;

use crate::utils::emulation::find_core_by_extension;

#[derive(Clone, Copy, PartialEq)]
enum ArchiveKind {
    Zip,
    SevenZ,
    Tar,
    TarGz,
    Gz,
}

fn kind_of(filename: &str) -> Option<ArchiveKind> {
    let lower = filename.to_lowercase();
    if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        Some(ArchiveKind::TarGz)
    } else if lower.ends_with(".tar") {
        Some(ArchiveKind::Tar)
    } else if lower.ends_with(".zip") {
        Some(ArchiveKind::Zip)
    } else if lower.ends_with(".7z") {
        Some(ArchiveKind::SevenZ)
    } else if lower.ends_with(".gz") {
        Some(ArchiveKind::Gz)
    } else {
        None
    }
}

pub fn is_archive(filename: &str) -> bool {
    kind_of(filename).is_some()
}

pub fn extract_archive(
    archive_path: &Path,
    dest_dir: &Path,
    original_filename: &str,
) -> Result<(), String> {
    let kind = kind_of(original_filename)
        .ok_or_else(|| format!("Unsupported archive format: {}", original_filename))?;

    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;

    match kind {
        ArchiveKind::Zip => extract_zip(archive_path, dest_dir),
        ArchiveKind::SevenZ => {
            sevenz_rust::decompress_file(archive_path, dest_dir).map_err(|e| e.to_string())
        }
        ArchiveKind::Tar => unpack_tar(open(archive_path)?, dest_dir),
        ArchiveKind::TarGz => unpack_tar(GzDecoder::new(open(archive_path)?), dest_dir),
        ArchiveKind::Gz => extract_gz(archive_path, dest_dir, original_filename),
    }
}

fn open(path: &Path) -> Result<File, String> {
    File::open(path).map_err(|e| e.to_string())
}

fn unpack_tar<R: Read>(reader: R, dest_dir: &Path) -> Result<(), String> {
    tar::Archive::new(reader)
        .unpack(dest_dir)
        .map_err(|e| e.to_string())
}

fn extract_zip(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(open(archive_path)?).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let out_path = match entry.enclosed_name() {
            Some(name) => dest_dir.join(name),
            None => continue,
        };

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut out_file = File::create(&out_path).map_err(|e| e.to_string())?;
        io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn extract_gz(archive_path: &Path, dest_dir: &Path, original_filename: &str) -> Result<(), String> {
    let inner_name = Path::new(original_filename)
        .file_name()
        .map(|s| s.to_string_lossy())
        .and_then(|s| s.strip_suffix(".gz").map(|s| s.to_string()))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "extracted".to_string());

    let mut decoder = GzDecoder::new(open(archive_path)?);
    let mut out_file = File::create(dest_dir.join(inner_name)).map_err(|e| e.to_string())?;
    io::copy(&mut decoder, &mut out_file).map_err(|e| e.to_string())?;
    Ok(())
}

pub struct ExtractedEntry {
    pub path: PathBuf,
    pub name: String,
    pub extension: String,
    pub supported: bool,
    pub console: String,
}

pub fn scan_extracted(dir: &Path) -> Vec<ExtractedEntry> {
    let mut out = Vec::new();
    walk(dir, dir, &mut out);
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn walk(base: &Path, current: &Path, out: &mut Vec<ExtractedEntry>) {
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk(base, &path, out);
            continue;
        }

        let extension = path
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let core = find_core_by_extension(&extension, None);
        let console = core
            .as_ref()
            .map(|c| {
                if !c.display_name.is_empty() {
                    c.display_name.clone()
                } else {
                    c.systemname.clone()
                }
            })
            .unwrap_or_default();
        let name = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .into_owned();

        out.push(ExtractedEntry {
            path,
            name,
            extension,
            supported: core.is_some(),
            console,
        });
    }
}
