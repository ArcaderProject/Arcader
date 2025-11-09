import cp from "child_process";
import fs from "fs";
import path from "path";
import terminate from "terminate";
import { getRetroArchAppImageName, getRetroArchHomeDirName } from "./directoryUtils.js";
import { broadcastUpdateScreen } from "../daemon/handlers/startGameHandler.js";

let currentPid = null;
let currentGame = null;
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

                if (!fs.existsSync(coreFilePath)) {
                    console.log(`Skipping ${coreName} - file not found in cores directory`);
                    continue;
                }

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

export const startEmulator = (core, gameFile, gameInfo = null) => {
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

    currentPid = null;
    currentGame = null;

    return true;
};

export const getCurrentGame = () => {
    return currentGame;
};
