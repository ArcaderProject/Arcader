import fs from "fs";
import https from "https";
import path from "path";
import os from "os";
import Seven from "node-7z";

export const RETROARCH_VERSION = "1.21.0";

export const getSystemArchitecture = () => (os.arch() === "x64" ? "x86_64" : "x86");

export const buildRetroArchUrl = (version = RETROARCH_VERSION, arch = getSystemArchitecture()) =>
    `https://buildbot.libretro.com/stable/${version}/linux/${arch}/RetroArch.7z`;

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
