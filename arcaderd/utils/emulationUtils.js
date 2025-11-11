import cp from "child_process";
import fs from "fs";
import path from "path";
import terminate from "terminate";
import { getRetroArchAppImageName, getRetroArchHomeDirName } from "./directoryUtils.js";
import { broadcastUpdateScreen } from "../daemon/handlers/startGameHandler.js";
import { applyRetroArchConfigOverrides } from "./retroarchConfigUtils.js";
import { getActiveSaveFolder, getSaveFolderPath } from "./gameSavesUtils.js";

let currentPid = null;
let currentGame = null;
let currentTempSaveFolder = null;
let cores = [];

const parseInfoFile = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n");
        const data = {};

        for (const line of lines) {
            if (line.trim().startsWith("#") || !line.trim()) continue;

            const match = line.match(/^(\w+)\s*=\s*"(.+)"$/);
            if (match) {
                data[match[1]] = match[2];
            }
        }

        return data;
    } catch (error) {
        console.error(`Error parsing info file ${filePath}:`, error);
        return null;
    }
};

const loadCoresData = () => {
    try {
        const coresInfoPath = path.join(
            process.cwd(),
            `data/retroarch/${getRetroArchHomeDirName()}/.config/retroarch/cores`
        );

        if (!fs.existsSync(coresInfoPath)) {
            console.error("RetroArch cores info directory not found:", coresInfoPath);
            return [];
        }

        const coresDir = path.join(process.cwd(), "data/cores");
        const infoFiles = fs
            .readdirSync(coresInfoPath)
            .filter((file) => file.endsWith("_libretro.info"));
        const coresData = [];

        for (const infoFile of infoFiles) {
            const infoPath = path.join(coresInfoPath, infoFile);
            const data = parseInfoFile(infoPath);

            if (data && data.display_name && data.supported_extensions) {
                const coreName = infoFile.replace("_libretro.info", "_libretro.so");
                const coreFilePath = path.join(coresDir, coreName);

                if (!fs.existsSync(coreFilePath)) continue;

                const extensions = data.supported_extensions
                    .split(/[|,]/)
                    .map((ext) => ext.trim())
                    .filter((ext) => ext.length > 0);

                coresData.push({
                    display_name: data.display_name,
                    core: coreName,
                    extensions: extensions,
                    systemname: data.systemname || "",
                    corename: data.corename || "",
                });
            }
        }

        console.log(`Loaded ${coresData.length} cores from RetroArch info files`);
        return coresData;
    } catch (error) {
        console.error("Error loading cores metadata:", error);
        return [];
    }
};

const isRunning = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
};

export const reloadCores = () => {
    cores = loadCoresData();
    return cores;
};

export const findCoreByExtension = (ext, preferredCore = null) => {
    if (preferredCore) {
        const core = cores.find((c) => c.core === preferredCore && c.extensions.includes(ext));
        if (core) return core;
    }

    const matchingCores = cores.filter((core) => core.extensions.includes(ext));

    if (matchingCores.length === 0) {
        return null;
    }

    const emulationCores = matchingCores.filter(
        (core) =>
            !core.display_name.toLowerCase().includes("utility") &&
            !core.display_name.toLowerCase().includes("debug")
    );

    const coresToChooseFrom = emulationCores.length > 0 ? emulationCores : matchingCores;

    return coresToChooseFrom.sort((a, b) => a.extensions.length - b.extensions.length)[0];
};

export const getCoresForExtension = (ext) => {
    return cores.filter((core) => core.extensions.includes(ext));
};

const isWayland = () => {
    return process.env.XDG_SESSION_TYPE === "wayland";
};

const copyDirRecursive = (src, dest) => {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
};
const createTempSaveFolder = (sourcePath, folderName) => {
    const tempPath = path.join(process.cwd(), "data", "temp_saves", `temp_${Date.now()}`);
    
    console.log(`[createTempSaveFolder] Creating temp folder for "${folderName}"`);
    console.log(`[createTempSaveFolder] Source path: ${sourcePath}`);
    console.log(`[createTempSaveFolder] Temp path: ${tempPath}`);
    
    try {
        fs.mkdirSync(tempPath, { recursive: true });
        console.log(`[createTempSaveFolder] Created temp directory: ${tempPath}`);
        
       if (fs.existsSync(sourcePath)) {
            console.log(`[createTempSaveFolder] Source exists, copying files...`);
            copyDirRecursive(sourcePath, tempPath);
            console.log(`[createTempSaveFolder] Successfully copied files to temporary folder`);
        } else {
            console.log(`[createTempSaveFolder] Source folder doesn't exist yet, created empty temp folder`);
        }
        
        return tempPath;
    } catch (error) {
        console.error("[createTempSaveFolder] Failed to create temporary save folder:", error);
        return sourcePath;
    }
};

const cleanupTempSaveFolder = (tempPath) => {
    if (!tempPath || !tempPath.includes("temp_saves")) return;
    
    try {
        if (fs.existsSync(tempPath)) {
            fs.rmSync(tempPath, { recursive: true, force: true });
            console.log(`Cleaned up temporary save folder: ${tempPath}`);
        }
    } catch (error) {
        console.error("Failed to cleanup temporary save folder:", error);
    }
};

export const startEmulator = (core, gameFile, gameInfo = null) => {
    const configOverrides = {};

    try {
        const activeSaveFolder = getActiveSaveFolder();
        
        if (activeSaveFolder) {
            let savePath = getSaveFolderPath(activeSaveFolder.uuid);

            if (activeSaveFolder.isLocked) {
                const tempPath = createTempSaveFolder(savePath, activeSaveFolder.name);
                currentTempSaveFolder = tempPath;
                savePath = tempPath;
            } else {
                currentTempSaveFolder = null;
            }
            
            configOverrides.savefile_directory = savePath;
            configOverrides.savestate_directory = savePath;
        }
    } catch (error) {
        console.error("[startEmulator] Failed to set save folder:", error);
    }

    if (Object.keys(configOverrides).length > 0) applyRetroArchConfigOverrides(configOverrides);
    
    const LD_PRELOAD = isWayland() ? "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0" : "";
    const retroarchPath = `./data/retroarch/${getRetroArchAppImageName()}`;
    const START_CMD = `${retroarchPath} -f -L ./data/cores/${core} ${gameFile}`;

    if (currentPid && isRunning(currentPid)) {
        console.error("Emulator already running");
        return false;
    }

    console.log("Spawning emulator with command: " + START_CMD);

    const proc = cp.spawn([`LD_PRELOAD=${LD_PRELOAD}`, START_CMD].join(" "), {
        shell: true,
    });

    proc.stdout.on("data", (data) => console.log(data.toString()));
    proc.stderr.on("data", (data) => console.error(data.toString()));

    proc.on("close", (code) => {
        console.log(`Emulator exited with code ${code}`);
        stop();
        broadcastScreen("SELECTION");
    });

    currentPid = proc.pid;
    currentGame = gameInfo;

    broadcastScreen("LOADING");

    return true;
};

const broadcastScreen = (screen) => {
    try {
        broadcastUpdateScreen(screen);
    } catch (error) {
        console.error("Error broadcasting screen update:", error);
    }
};

export const start = (gameFile, gameInfo = null) => {
    const ext = gameFile.split(".").pop();

    const core =
        gameInfo && gameInfo.core
            ? findCoreByExtension(ext, gameInfo.core)
            : findCoreByExtension(ext);

    if (!core) {
        console.error("No core found for this file extension");
        return false;
    }

    console.log(`Selected core: ${core.display_name} (${core.core}) for extension .${ext}`);

    return startEmulator(core.core, gameFile, gameInfo);
};

export const startByFilename = (filename, gameInfo = null) => {
    const romPath = path.join(process.cwd(), "data", "roms", filename);

    if (!fs.existsSync(romPath)) {
        console.error("Game file not found");
        return false;
    }

    return start(romPath, gameInfo);
};

export const stop = () => {
    if (currentPid && isRunning(currentPid)) {
        terminate(currentPid, () => {
            console.log("Emulator closed");
        });
    }

    if (currentTempSaveFolder) {
        cleanupTempSaveFolder(currentTempSaveFolder);
        currentTempSaveFolder = null;
    }

    currentPid = null;
    currentGame = null;

    return true;
};

export const getCurrentGame = () => {
    return currentGame;
};
