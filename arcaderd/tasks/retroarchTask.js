import fs from "fs";
import path from "path";
import {
    ensureDataDirectories,
    isRetroArchInstalled,
    moveDirectoryContents,
} from "../utils/directoryUtils.js";
import {
    buildRetroArchUrl,
    downloadFile,
    extract7z,
    waitForInternet,
} from "../utils/downloadUtils.js";

export const ensureRetroArch = async (workingDir = process.cwd()) => {
    try {
        const { retroarchDir } = ensureDataDirectories(workingDir);

        if (isRetroArchInstalled(retroarchDir)) {
            console.log("RetroArch already installed");
            return;
        }

        console.log("RetroArch not found, downloading...");

        const hasInternet = await waitForInternet();
        if (!hasInternet) {
            throw new Error(
                "No internet connection available. RetroArch will be downloaded when internet is restored."
            );
        }

        const downloadUrl = buildRetroArchUrl();
        const archivePath = path.join(retroarchDir, "RetroArch.7z");

        await downloadFile(downloadUrl, archivePath);
        await extract7z(archivePath, retroarchDir);

        const extractedSubDir = path.join(retroarchDir, "RetroArch-Linux-x86_64");
        if (fs.existsSync(extractedSubDir)) {
            moveDirectoryContents(extractedSubDir, retroarchDir);
            console.log("Moved RetroArch files to retroarch directory");
        }

        if (isRetroArchInstalled(retroarchDir)) {
            console.log("RetroArch setup completed");
        } else {
            throw new Error("RetroArch installation verification failed");
        }
    } catch (error) {
        console.error("RetroArch setup failed:", error.message);
        throw error;
    }
};

export const runRetroArchTask = async () => {
    try {
        await ensureRetroArch();
        return { success: true, message: "RetroArch setup completed" };
    } catch (error) {
        return { success: false, message: error.message };
    }
};
