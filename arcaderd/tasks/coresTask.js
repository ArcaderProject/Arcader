import fs from "fs";
import path from "path";
import {
    ensureDataDirectories,
    isRetroArchInstalled,
    areCoresInstalled,
} from "../utils/directoryUtils.js";
import {
    buildRetroArchCoresUrl,
    downloadFile,
    extract7z,
    waitForInternet,
} from "../utils/downloadUtils.js";

const verifyCoresInstallation = (coresDir) => {
    if (!fs.existsSync(coresDir)) {
        return {
            success: false,
            message: "Cores directory does not exist",
            coreCount: 0,
            infoCount: 0,
        };
    }

    const files = fs.readdirSync(coresDir);
    const coreFiles = files.filter((file) => file.endsWith("_libretro.so"));
    const infoFiles = files.filter((file) => file.endsWith("_libretro.info"));

    const success = coreFiles.length > 0;

    return {
        success,
        message: success
            ? `Found ${coreFiles.length} core libraries and ${infoFiles.length} info files`
            : `Installation incomplete: ${coreFiles.length} cores, ${infoFiles.length} info files`,
        coreCount: coreFiles.length,
        infoCount: infoFiles.length,
    };
};

const cleanupArchive = (archivePath) => {
    if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
        console.log("Archive cleaned up");
    }
};

const extractCores = async (archivePath, coresDir) => {
    const tempExtractDir = path.join(path.dirname(coresDir), "temp_cores_extract");

    try {
        await extract7z(archivePath, tempExtractDir);

        if (!fs.existsSync(coresDir)) {
            fs.mkdirSync(coresDir, { recursive: true });
            console.log("Created cores directory");
        }

        let sourceCoresDir;

        const findCoresDirectory = (dir) => {
            if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
                return null;
            }

            const items = fs.readdirSync(dir);

            if (items.some((item) => item.endsWith("_libretro.so"))) return dir;

            for (const item of items) {
                const itemPath = path.join(dir, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    const found = findCoresDirectory(itemPath);
                    if (found) return found;
                }
            }

            return null;
        };

        sourceCoresDir = findCoresDirectory(tempExtractDir);

        if (!sourceCoresDir) {
            throw new Error("Could not find cores directory in extracted archive");
        }

        const coreFiles = fs.readdirSync(sourceCoresDir);
        let copiedCount = 0;

        for (const file of coreFiles) {
            if (file.endsWith("_libretro.so")) {
                const sourcePath = path.join(sourceCoresDir, file);
                const targetPath = path.join(coresDir, file);

                fs.copyFileSync(sourcePath, targetPath);
                copiedCount++;
            }
        }

        console.log(`Copied ${copiedCount} core libraries to ${coresDir}`);

        if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
    } catch (error) {
        if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
        throw error;
    }
};

export const ensureRetroArchCores = async (workingDir = process.cwd()) => {
    try {
        const { retroarchDir, coresDir } = ensureDataDirectories(workingDir);

        if (!isRetroArchInstalled(retroarchDir)) {
            return {
                success: false,
                message: "RetroArch must be installed before installing cores",
                requiresRetroArch: true,
            };
        }

        if (areCoresInstalled(coresDir)) {
            const verification = verifyCoresInstallation(coresDir);
            console.log("RetroArch cores already installed");
            return {
                success: true,
                message: "Cores already installed",
                alreadyInstalled: true,
                ...verification,
            };
        }

        console.log("RetroArch cores not found, downloading...");

        const hasInternet = await waitForInternet();
        if (!hasInternet) {
            return {
                success: false,
                message:
                    "No internet connection available. Cores will be downloaded when internet is restored.",
                requiresInternet: true,
            };
        }

        const downloadUrl = buildRetroArchCoresUrl();
        const archivePath = path.join(retroarchDir, "RetroArch_cores.7z");

        try {
            await downloadFile(downloadUrl, archivePath);
        } catch (error) {
            cleanupArchive(archivePath);
            throw new Error(`Failed to download cores: ${error.message}`);
        }

        if (!fs.existsSync(archivePath)) {
            throw new Error("Downloaded archive file not found");
        }

        const stats = fs.statSync(archivePath);
        if (stats.size === 0) {
            cleanupArchive(archivePath);
            throw new Error("Downloaded archive is empty");
        }

        console.log(
            `Archive downloaded successfully (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`
        );

        try {
            await extractCores(archivePath, coresDir);
        } catch (error) {
            cleanupArchive(archivePath);
            throw new Error(`Failed to extract cores: ${error.message}`);
        }

        cleanupArchive(archivePath);

        const verification = verifyCoresInstallation(coresDir);

        if (!verification.success) {
            throw new Error(verification.message);
        }

        console.log("RetroArch cores setup completed successfully");
        return { success: true, message: "Cores installed successfully", ...verification };
    } catch (error) {
        console.error("RetroArch cores setup failed:", error.message);
        return { success: false, message: error.message, error: error };
    }
};

export const runCoresTask = async () => {
    return await ensureRetroArchCores();
};
