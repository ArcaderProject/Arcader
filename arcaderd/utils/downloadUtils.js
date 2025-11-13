import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import os from "os";
import Seven from "node-7z";

export const RETROARCH_VERSION = "1.21.0";

export const getSystemArchitecture = () => (os.arch() === "x64" ? "x86_64" : "x86");

export const buildRetroArchUrl = (version = RETROARCH_VERSION, arch = getSystemArchitecture()) =>
    `https://buildbot.libretro.com/stable/${version}/linux/${arch}/RetroArch.7z`;

export const buildRetroArchCoresUrl = (version = RETROARCH_VERSION, arch = getSystemArchitecture()) =>
    `https://buildbot.libretro.com/stable/${version}/linux/${arch}/RetroArch_cores.7z`;

export const checkInternetConnectivity = async (timeout = 5000) => {
    return new Promise((resolve) => {
        const request = http.get("http://detectportal.firefox.com/success.txt", { timeout }, (res) => {
            resolve(res.statusCode === 200);
            res.resume();
        });
        
        request.on('error', () => resolve(false));
        request.on('timeout', () => {
            request.destroy();
            resolve(false);
        });
    });
};

export const waitForInternet = async (maxRetries = 30, retryDelay = 10000) => {
    for (let i = 0; i < maxRetries; i++) {
        console.log(`Checking internet connectivity (attempt ${i + 1}/${maxRetries})...`);
        
        if (await checkInternetConnectivity()) {
            console.log("Internet connection available");
            return true;
        }
        
        if (i < maxRetries - 1) {
            console.log(`No internet connection. Waiting ${retryDelay / 1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    console.log("Failed to establish internet connection after all retries");
    return false;
};

export const downloadFile = (url, outputPath) => {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${url}`);

        const file = fs.createWriteStream(outputPath);

        https
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const totalSize = parseInt(response.headers["content-length"], 10);
                let downloadedSize = 0;
                let lastProgressUpdate = 0;

                response.on("data", (chunk) => {
                    downloadedSize += chunk.length;

                    if (
                        totalSize &&
                        (downloadedSize - lastProgressUpdate > 1024 * 1024 ||
                            downloadedSize === totalSize)
                    ) {
                        const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                        const downloadedMB = (downloadedSize / (1024 * 1024)).toFixed(1);
                        const totalMB = (totalSize / (1024 * 1024)).toFixed(1);

                        process.stdout.write(
                            `\rProgress: ${progress}% (${downloadedMB}MB / ${totalMB}MB)`
                        );
                        lastProgressUpdate = downloadedSize;
                    }
                });

                response.pipe(file);

                file.on("finish", () => {
                    file.close();
                    console.log("\nDownload completed");
                    resolve();
                });

                file.on("error", (err) => {
                    fs.unlink(outputPath, () => {});
                    reject(err);
                });
            })
            .on("error", (err) => reject(err));
    });
};

export const extract7z = (archivePath, extractDir) => {
    return new Promise((resolve, reject) => {
        console.log(`Extracting ${path.basename(archivePath)}...`);

        const stream = Seven.extractFull(archivePath, extractDir, {
            $progress: true,
            overwrite: "a",
            $cherryPick: ["*.so", "*.info"],
        });

        stream.on("progress", (progress) => {
            if (progress.percent !== undefined) {
                process.stdout.write(`\rExtracting: ${progress.percent}%`);
            }
        });

        stream.on("end", () => {
            console.log("\nExtraction completed");

            fs.unlink(archivePath, (err) => {
                if (!err) console.log("Archive cleaned up");
            });

            resolve();
        });

        stream.on("error", (err) => reject(err));
    });
};
