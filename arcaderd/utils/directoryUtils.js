import fs from "fs";
import path from "path";
import { getSystemArchitecture } from "./downloadUtils.js";

export const getRetroArchAppImageName = (arch = getSystemArchitecture()) => 
    `RetroArch-Linux-${arch}.AppImage`;

export const getRetroArchHomeDirName = (arch = getSystemArchitecture()) => 
    `RetroArch-Linux-${arch}.AppImage.home`;

export const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

export const ensureDataDirectories = (workingDir = process.cwd()) => {
    const dataDir = path.join(workingDir, "data");
    const retroarchDir = path.join(dataDir, "retroarch");
    const coresDir = path.join(dataDir, "cores");
    const romsDir = path.join(dataDir, "roms");
    const coversDir = path.join(dataDir, "covers");

    ensureDirectoryExists(dataDir);
    ensureDirectoryExists(retroarchDir);
    ensureDirectoryExists(coresDir);
    ensureDirectoryExists(romsDir);
    ensureDirectoryExists(coversDir);

    return { dataDir, retroarchDir, coresDir, romsDir, coversDir };
};

export const isRetroArchInstalled = () => {
    const retroarchDir = path.join(".", "data", "retroarch");
    const retroarchAppImage = path.join(retroarchDir, getRetroArchAppImageName());
    
    return fs.existsSync(retroarchAppImage);
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
