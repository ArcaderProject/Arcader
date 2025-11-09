import fs from "fs";
import path from "path";

export const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

export const ensureDataDirectories = (workingDir = process.cwd()) => {
    const dataDir = path.join(workingDir, "data");
    const retroarchDir = path.join(dataDir, "retroarch");

    ensureDirectoryExists(dataDir);
    ensureDirectoryExists(retroarchDir);

    return { dataDir, retroarchDir };
};

export const isRetroArchInstalled = (retroarchDir) => {
    const AppImage = path.join(retroarchDir, "RetroArch-Linux-x86_64.AppImage");
    const HomeDir = path.join(retroarchDir, "RetroArch-Linux-x86_64.AppImage.home");
    return fs.existsSync(AppImage) && fs.existsSync(HomeDir);
};

export const getRetroArchExecutablePath = (retroarchDir) => {
    return path.join(retroarchDir, "RetroArch-Linux-x86_64.AppImage");
};

export const moveDirectoryContents = (sourceDir, targetDir) => {
    const items = fs.readdirSync(sourceDir);

    for (const item of items) {
        const sourcePath = path.join(sourceDir, item);
        const targetPath = path.join(targetDir, item);

        fs.renameSync(sourcePath, targetPath);
    }

    fs.rmdirSync(sourceDir);
};
