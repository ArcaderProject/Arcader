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
    const coresDir = path.join(dataDir, "cores");

    ensureDirectoryExists(dataDir);
    ensureDirectoryExists(retroarchDir);
    ensureDirectoryExists(coresDir);

    return { dataDir, retroarchDir, coresDir };
};

export const isRetroArchInstalled = (retroarchDir) => {
    const AppImage = path.join(retroarchDir, "RetroArch-Linux-x86_64.AppImage");
    const HomeDir = path.join(retroarchDir, "RetroArch-Linux-x86_64.AppImage.home");
    return fs.existsSync(AppImage) && fs.existsSync(HomeDir);
};

export const areCoresInstalled = (coresDir) => {
    if (!fs.existsSync(coresDir)) {
        return false;
    }

    const files = fs.readdirSync(coresDir);
    const coreFiles = files.filter(file => file.endsWith('_libretro.so'));
    
    return coreFiles.length > 0;
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
