use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use tokio::sync::Notify;

use crate::utils::config::{get_config, set_config};
use crate::utils::database::{execute, query_json, query_one_json};
use crate::utils::directory::ensure_executable;
use crate::utils::download::{download_file, get_system_architecture};
use crate::utils::paths::cwd;

const ARCADERD_VERSION: &str = env!("CARGO_PKG_VERSION");
const MANIFEST_FILE: &str = "arcader-frontend.json";
const VERSION_MARKER: &str = ".arcader-version";

static RESTART: Lazy<Notify> = Lazy::new(Notify::new);

#[derive(Debug, Deserialize)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub entry: String,
    #[serde(default, rename = "entryArgs")]
    pub entry_args: Vec<String>,
    #[serde(default)]
    pub compatibility: Compatibility,
    pub release: Release,
}

#[derive(Debug, Default, Deserialize)]
pub struct Compatibility {
    #[serde(default)]
    pub arcaderd: String,
}

#[derive(Debug, Deserialize)]
pub struct Release {
    pub repo: String,
    #[serde(default)]
    pub assets: HashMap<String, String>,
}

pub fn frontends_dir() -> PathBuf {
    cwd().join("frontends")
}

pub fn frontend_dir(id: &str) -> PathBuf {
    frontends_dir().join(id)
}

fn current_symlink() -> PathBuf {
    frontends_dir().join("current")
}

pub fn arch_key() -> &'static str {
    if get_system_architecture() == "x86_64" {
        "x86_64"
    } else {
        "x86_32"
    }
}

fn raw_base() -> String {
    std::env::var("ARCADER_GITHUB_RAW_BASE")
        .unwrap_or_else(|_| "https://raw.githubusercontent.com".to_string())
}

fn api_base() -> String {
    std::env::var("ARCADER_GITHUB_API_BASE").unwrap_or_else(|_| "https://api.github.com".to_string())
}

fn github_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("arcaderd")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub fn parse_github_repo(url: &str) -> Option<(String, String)> {
    let s = url.trim();
    let s = s
        .strip_prefix("https://")
        .or_else(|| s.strip_prefix("http://"))
        .unwrap_or(s);
    let s = s.strip_prefix("github.com/")?;
    let s = s.strip_suffix('/').unwrap_or(s);
    let s = s.strip_suffix(".git").unwrap_or(s);
    let mut parts = s.split('/');
    let owner = parts.next()?.to_string();
    let repo = parts.next()?.to_string();
    if owner.is_empty() || repo.is_empty() {
        return None;
    }
    Some((owner, repo))
}

fn owner_repo(s: &str) -> Option<(String, String)> {
    if let Some(pair) = parse_github_repo(s) {
        return Some(pair);
    }
    let mut parts = s.split('/');
    let owner = parts.next()?.to_string();
    let repo = parts.next()?.to_string();
    if owner.is_empty() || repo.is_empty() {
        None
    } else {
        Some((owner, repo))
    }
}

pub async fn fetch_manifest(repo_url: &str) -> Result<Manifest, String> {
    let (owner, repo) =
        parse_github_repo(repo_url).ok_or_else(|| "Not a GitHub repository URL".to_string())?;
    let url = format!("{}/{}/{}/HEAD/{}", raw_base(), owner, repo, MANIFEST_FILE);
    let resp = github_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!(
            "Could not fetch {} (HTTP {})",
            MANIFEST_FILE,
            resp.status().as_u16()
        ));
    }
    let text = resp.text().await.map_err(|e| e.to_string())?;
    serde_json::from_str::<Manifest>(&text).map_err(|e| format!("Invalid manifest: {}", e))
}

async fn latest_release(repo: &str) -> Result<(String, HashMap<String, String>), String> {
    let (owner, name) = owner_repo(repo).ok_or_else(|| "Invalid release repo".to_string())?;
    let url = format!("{}/repos/{}/{}/releases/latest", api_base(), owner, name);
    let resp = github_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!(
            "Could not look up latest release (HTTP {})",
            resp.status().as_u16()
        ));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let tag = body
        .get("tag_name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Release has no tag_name".to_string())?
        .to_string();
    let mut assets = HashMap::new();
    if let Some(arr) = body.get("assets").and_then(|v| v.as_array()) {
        for a in arr {
            if let (Some(n), Some(u)) = (
                a.get("name").and_then(|v| v.as_str()),
                a.get("browser_download_url").and_then(|v| v.as_str()),
            ) {
                assets.insert(n.to_string(), u.to_string());
            }
        }
    }
    Ok((tag, assets))
}

pub fn is_compatible(range: &str) -> bool {
    if range.trim().is_empty() {
        return true;
    }
    let current = match semver::Version::parse(ARCADERD_VERSION) {
        Ok(v) => v,
        Err(_) => return true,
    };
    match semver::VersionReq::parse(range) {
        Ok(req) => req.matches(&current),
        Err(_) => true,
    }
}

fn format_frontend(mut row: Map<String, Value>, active_id: &str) -> Map<String, Value> {
    let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let args = row
        .get("entry_args")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .filter(|v| v.is_array())
        .unwrap_or_else(|| Value::Array(vec![]));
    row.insert("entryArgs".to_string(), args);
    row.remove("entry_args");
    row.insert("repoUrl".to_string(), row.get("repo_url").cloned().unwrap_or(Value::Null));
    row.remove("repo_url");
    row.insert(
        "installedVersion".to_string(),
        row.get("installed_version").cloned().unwrap_or(Value::Null),
    );
    row.remove("installed_version");
    row.insert("active".to_string(), Value::Bool(id == active_id));
    row.insert("arch".to_string(), Value::from(arch_key()));
    let compat = row.get("compat").and_then(|v| v.as_str()).unwrap_or("");
    row.insert("compatible".to_string(), Value::Bool(is_compatible(compat)));
    row
}

pub fn get_all() -> Vec<Map<String, Value>> {
    let active = active_id();
    query_json("SELECT * FROM frontends ORDER BY added_at ASC", &[])
        .into_iter()
        .map(|r| format_frontend(r, &active))
        .collect()
}

pub fn get_by_id(id: &str) -> Option<Map<String, Value>> {
    let active = active_id();
    query_one_json("SELECT * FROM frontends WHERE id = ?", &[&id]).map(|r| format_frontend(r, &active))
}

fn raw_by_id(id: &str) -> Option<Map<String, Value>> {
    query_one_json("SELECT * FROM frontends WHERE id = ?", &[&id])
}

pub fn active_id() -> String {
    get_config("frontend.active", None).unwrap_or_else(|| "main".to_string())
}

fn upsert_from_manifest(m: &Manifest, repo_url: &str) {
    let args = serde_json::to_string(&m.entry_args).unwrap_or_else(|_| "[]".to_string());
    execute(
        "INSERT INTO frontends (id, name, description, repo_url, entry, entry_args, compat) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET \
           name = excluded.name, description = excluded.description, \
           repo_url = excluded.repo_url, entry = excluded.entry, \
           entry_args = excluded.entry_args, compat = excluded.compat",
        &[
            &m.id,
            &m.name,
            &m.description,
            &repo_url,
            &m.entry,
            &args,
            &m.compatibility.arcaderd,
        ],
    );
}

fn set_installed_version(id: &str, version: &str) {
    execute(
        "UPDATE frontends SET installed_version = ? WHERE id = ?",
        &[&version, &id],
    );
}

fn entry_for(id: &str) -> Option<(String, Vec<String>)> {
    let row = raw_by_id(id)?;
    let entry = row.get("entry").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if entry.is_empty() {
        return None;
    }
    let args = row
        .get("entry_args")
        .and_then(|v| v.as_str())
        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
        .unwrap_or_default();
    Some((entry, args))
}

pub fn is_installed(id: &str) -> bool {
    match entry_for(id) {
        Some((entry, _)) => frontend_dir(id).join(entry).exists(),
        None => false,
    }
}

fn extract_tar_gz(archive: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(archive).map_err(|e| e.to_string())?;
    let gz = flate2::read::GzDecoder::new(file);
    let mut ar = tar::Archive::new(gz);
    ar.unpack(dest).map_err(|e| e.to_string())
}

pub async fn install(id: &str) -> Result<String, String> {
    let row = raw_by_id(id).ok_or_else(|| "Frontend not registered".to_string())?;
    let repo_url = row
        .get("repo_url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let manifest = fetch_manifest(&repo_url).await?;
    if !is_compatible(&manifest.compatibility.arcaderd) {
        return Err(format!(
            "Frontend '{}' requires arcaderd {} but this is {}",
            manifest.name, manifest.compatibility.arcaderd, ARCADERD_VERSION
        ));
    }
    upsert_from_manifest(&manifest, &repo_url);

    let asset_name = manifest
        .release
        .assets
        .get(arch_key())
        .ok_or_else(|| format!("No release asset for architecture {}", arch_key()))?;

    let (tag, assets) = latest_release(&manifest.release.repo).await?;
    let url = assets
        .get(asset_name)
        .ok_or_else(|| format!("Release {} has no asset '{}'", tag, asset_name))?;

    fs::create_dir_all(frontends_dir()).map_err(|e| e.to_string())?;
    let tmp = frontends_dir().join(format!(".{}.download", id));
    download_file(url, &tmp).await?;

    let dir = frontend_dir(id);
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let extracted = extract_tar_gz(&tmp, &dir);
    let _ = fs::remove_file(&tmp);
    extracted?;

    if !manifest.entry.is_empty() {
        ensure_executable(&dir.join(&manifest.entry));
    }
    let _ = fs::write(dir.join(VERSION_MARKER), &tag);
    set_installed_version(id, &tag);

    if id == active_id() {
        update_current_symlink(id);
    }
    Ok(tag)
}

pub async fn add_and_install(repo_url: &str) -> Result<String, String> {
    let manifest = fetch_manifest(repo_url).await?;
    if !is_compatible(&manifest.compatibility.arcaderd) {
        return Err(format!(
            "Frontend '{}' requires arcaderd {} but this is {}",
            manifest.name, manifest.compatibility.arcaderd, ARCADERD_VERSION
        ));
    }
    let id = manifest.id.clone();
    upsert_from_manifest(&manifest, repo_url);
    install(&id).await?;
    Ok(id)
}

pub async fn check_update(id: &str) -> Result<Value, String> {
    let row = raw_by_id(id).ok_or_else(|| "Frontend not registered".to_string())?;
    let repo_url = row.get("repo_url").and_then(|v| v.as_str()).unwrap_or("");
    let installed = row
        .get("installed_version")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let manifest = fetch_manifest(repo_url).await?;
    let (tag, _) = latest_release(&manifest.release.repo).await?;
    Ok(json!({
        "id": id,
        "installedVersion": installed,
        "latestVersion": tag,
        "updateAvailable": !installed.is_empty() && installed != tag,
        "compatible": is_compatible(&manifest.compatibility.arcaderd),
    }))
}

fn update_current_symlink(id: &str) {
    let link = current_symlink();
    let _ = fs::remove_file(&link);
    #[cfg(unix)]
    {
        let _ = std::os::unix::fs::symlink(frontend_dir(id), &link);
    }
}

pub fn set_active(id: &str) -> Result<(), String> {
    if raw_by_id(id).is_none() {
        return Err("Frontend not registered".to_string());
    }
    if !is_installed(id) {
        return Err("Frontend is not installed yet".to_string());
    }
    set_config("frontend.active", id);
    update_current_symlink(id);
    RESTART.notify_one();
    Ok(())
}

pub fn restart() {
    RESTART.notify_one();
}

pub fn remove(id: &str) -> Result<(), String> {
    if id == active_id() {
        return Err("Cannot remove the active frontend".to_string());
    }
    if id == "main" {
        return Err("Cannot remove the default frontend".to_string());
    }
    let _ = fs::remove_dir_all(frontend_dir(id));
    execute("DELETE FROM frontends WHERE id = ?", &[&id]);
    Ok(())
}

fn display_env() -> (String, String) {
    let display = std::env::var("DISPLAY").unwrap_or_else(|_| ":0".to_string());
    let xauthority = std::env::var("XAUTHORITY").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_default();
        format!("{}/.Xauthority", home)
    });
    (display, xauthority)
}

fn launch_active() -> Option<tokio::process::Child> {
    let id = active_id();
    let (entry, args) = entry_for(&id)?;
    let dir = frontend_dir(&id);
    let bin = dir.join(&entry);
    if !bin.exists() {
        return None;
    }
    ensure_executable(&bin);

    let (display, xauthority) = display_env();
    let mut command = tokio::process::Command::new(&bin);
    command
        .args(&args)
        .current_dir(&dir)
        .env("DISPLAY", display)
        .env("XAUTHORITY", xauthority)
        .process_group(0)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    match command.spawn() {
        Ok(child) => {
            println!("[frontend] launched '{}' ({})", id, bin.display());
            Some(child)
        }
        Err(e) => {
            eprintln!("[frontend] failed to launch '{}': {}", id, e);
            None
        }
    }
}

pub fn start_supervisor() {
    tokio::spawn(async move {
        loop {
            match launch_active() {
                Some(mut child) => {
                    let pid = child.id();
                    tokio::select! {
                        _ = child.wait() => {
                            println!("[frontend] exited; respawning");
                        }
                        _ = RESTART.notified() => {
                            if let Some(p) = pid {
                                let _ = nix::sys::signal::killpg(
                                    nix::unistd::Pid::from_raw(p as i32),
                                    nix::sys::signal::Signal::SIGTERM,
                                );
                            }
                            let _ = child.wait().await;
                        }
                    }
                }
                None => {
                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_secs(2)) => {}
                        _ = RESTART.notified() => {}
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    });
}

fn read_local_manifest(id: &str) -> Option<Manifest> {
    let path = frontend_dir(id).join(MANIFEST_FILE);
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Manifest>(&text).ok()
}

fn read_version_marker(id: &str) -> Option<String> {
    fs::read_to_string(frontend_dir(id).join(VERSION_MARKER))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub async fn bootstrap() {
    let _ = fs::create_dir_all(frontends_dir());

    let default_repo = get_config("frontend.defaultRepo", None)
        .unwrap_or_else(|| "https://github.com/ArcaderProject/Frontend".to_string());

    if raw_by_id("main").is_none() {
        if let Some(manifest) = read_local_manifest("main") {
            upsert_from_manifest(&manifest, &default_repo);
            if let Some(ver) = read_version_marker("main") {
                set_installed_version("main", &ver);
            }
            println!("[frontend] registered pre-installed default frontend");
        } else if let Ok(manifest) = fetch_manifest(&default_repo).await {
            upsert_from_manifest(&manifest, &default_repo);
        } else {
            eprintln!("[frontend] could not resolve default frontend manifest yet");
        }
    }

    let active = active_id();
    update_current_symlink(&active);

    if !is_installed(&active) {
        println!("[frontend] '{}' not installed; downloading...", active);
        match install(&active).await {
            Ok(v) => println!("[frontend] installed '{}' {}", active, v),
            Err(e) => eprintln!("[frontend] install failed: {}", e),
        }
    } else if let Ok(status) = check_update(&active).await {
        let newer = status.get("updateAvailable").and_then(|v| v.as_bool()).unwrap_or(false);
        let compatible = status.get("compatible").and_then(|v| v.as_bool()).unwrap_or(false);
        if newer && compatible {
            println!(
                "[frontend] updating '{}' to {}",
                active,
                status.get("latestVersion").and_then(|v| v.as_str()).unwrap_or("?")
            );
            if install(&active).await.is_ok() {
                restart();
            }
        }
    }
}
