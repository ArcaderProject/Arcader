use futures_util::StreamExt;
use std::io::Write;
use std::path::Path;
use std::time::Duration;

pub const RETROARCH_VERSION: &str = "1.21.0";

pub fn get_system_architecture() -> String {
    if std::env::consts::ARCH == "x86_64" {
        "x86_64".to_string()
    } else {
        "x86".to_string()
    }
}

pub fn build_retro_arch_url(version: &str, arch: &str) -> String {
    format!(
        "https://buildbot.libretro.com/stable/{}/linux/{}/RetroArch.7z",
        version, arch
    )
}

pub fn build_retro_arch_cores_url(version: &str, arch: &str) -> String {
    format!(
        "https://buildbot.libretro.com/stable/{}/linux/{}/RetroArch_cores.7z",
        version, arch
    )
}

pub async fn check_internet_connectivity(timeout: Duration) -> bool {
    let client = match reqwest::Client::builder().timeout(timeout).build() {
        Ok(c) => c,
        Err(_) => return false,
    };

    match client
        .get("http://detectportal.firefox.com/success.txt")
        .send()
        .await
    {
        Ok(res) => res.status().as_u16() == 200,
        Err(_) => false,
    }
}

pub async fn wait_for_internet(max_retries: u32, retry_delay: Duration) -> bool {
    for i in 0..max_retries {
        println!(
            "Checking internet connectivity (attempt {}/{})...",
            i + 1,
            max_retries
        );

        if check_internet_connectivity(Duration::from_secs(5)).await {
            println!("Internet connection available");
            return true;
        }

        if i < max_retries - 1 {
            println!(
                "No internet connection. Waiting {} seconds before retry...",
                retry_delay.as_secs()
            );
            tokio::time::sleep(retry_delay).await;
        }
    }

    println!("Failed to establish internet connection after all retries");
    false
}

pub async fn is_clock_synchronized() -> bool {
    match tokio::process::Command::new("timedatectl")
        .args(["show", "-p", "NTPSynchronized", "--value"])
        .output()
        .await
    {
        Ok(output) => String::from_utf8_lossy(&output.stdout).trim() == "yes",
        Err(_) => false,
    }
}

pub async fn wait_for_clock_sync(max_retries: u32, retry_delay: Duration) -> bool {
    for i in 0..max_retries {
        println!(
            "Waiting for system clock synchronization (attempt {}/{})...",
            i + 1,
            max_retries
        );

        if is_clock_synchronized().await {
            println!("System clock synchronized");
            return true;
        }

        if i < max_retries - 1 {
            tokio::time::sleep(retry_delay).await;
        }
    }

    println!("System clock not synchronized after all retries; proceeding anyway");
    false
}

pub async fn download_file(url: &str, output_path: &Path) -> Result<(), String> {
    println!("Downloading: {}", url);

    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;

    if response.status().as_u16() != 200 {
        return Err(format!(
            "HTTP {}: {}",
            response.status().as_u16(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("")
        ));
    }

    let total_size = response.content_length();
    let mut downloaded_size: u64 = 0;
    let mut last_progress_update: u64 = 0;

    let mut file = std::fs::File::create(output_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded_size += chunk.len() as u64;

        if let Some(total) = total_size {
            if total > 0
                && (downloaded_size - last_progress_update > 1024 * 1024
                    || downloaded_size == total)
            {
                let progress = (downloaded_size as f64 / total as f64) * 100.0;
                let downloaded_mb = downloaded_size as f64 / (1024.0 * 1024.0);
                let total_mb = total as f64 / (1024.0 * 1024.0);

                print!(
                    "\rProgress: {:.1}% ({:.1}MB / {:.1}MB)",
                    progress, downloaded_mb, total_mb
                );
                let _ = std::io::stdout().flush();
                last_progress_update = downloaded_size;
            }
        }
    }

    println!("\nDownload completed");
    Ok(())
}

pub fn extract_7z(archive_path: &Path, extract_dir: &Path) -> Result<(), String> {
    println!(
        "Extracting {}...",
        archive_path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default()
    );

    sevenz_rust::decompress_file(archive_path, extract_dir).map_err(|e| e.to_string())?;

    println!("\nExtraction completed");

    if std::fs::remove_file(archive_path).is_ok() {
        println!("Archive cleaned up");
    }

    Ok(())
}
