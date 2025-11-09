import cp from "child_process";
import fs from "fs";
import path from "path";
import terminate from "terminate";

let currentPid = null;
let cores = [];

const parseInfoFile = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const data = {};

        for (const line of lines) {
            if (line.trim().startsWith('#') || !line.trim()) continue;

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
        const coresInfoPath = path.join(process.cwd(), 'data/retroarch/RetroArch-Linux-x86_64.AppImage.home/.config/retroarch/cores');
        
        if (!fs.existsSync(coresInfoPath)) {
            console.error('RetroArch cores info directory not found:', coresInfoPath);
            return [];
        }

        const infoFiles = fs.readdirSync(coresInfoPath).filter(file => file.endsWith('_libretro.info'));
        const coresData = [];

        for (const infoFile of infoFiles) {
            const infoPath = path.join(coresInfoPath, infoFile);
            const data = parseInfoFile(infoPath);

            if (data && data.display_name && data.supported_extensions) {
                const coreName = infoFile.replace('_libretro.info', '_libretro.so');

                const extensions = data.supported_extensions
                    .split(/[|,]/)
                    .map(ext => ext.trim())
                    .filter(ext => ext.length > 0);

                coresData.push({
                    display_name: data.display_name,
                    core: coreName,
                    extensions: extensions,
                    systemname: data.systemname || '',
                    corename: data.corename || ''
                });
            }
        }

        console.log(`Loaded ${coresData.length} cores from RetroArch info files`);
        return coresData;
    } catch (error) {
        console.error('Error loading cores metadata:', error);
        return [];
    }
}

const isRunning = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

export const reloadCores = () => {
    cores = loadCoresData();
    return cores;
}

export const findCoreByExtension = (ext) => {
    return cores.find(core => core.extensions.includes(ext));
}

const isWayland = () => {
    return process.env.XDG_SESSION_TYPE === "wayland";
}

export const startEmulator = (core, gameFile) => {
    const LD_PRELOAD = isWayland() ? "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0" : "";
    const START_CMD = "./data/retro.AppImage -f -L ./data/cores/" + core + " " + gameFile;

    if (currentPid && isRunning(currentPid)) {
        console.error("Emulator already running");
        return;
    }

    console.log("Spawning emulator with command: " + START_CMD);

    const proc = cp.spawn([`LD_PRELOAD=${LD_PRELOAD}`, START_CMD].join(" "), {
        shell: true
    });

    proc.stdout.on("data", (data) => console.log(data.toString()));
    proc.stderr.on("data", (data) => console.error(data.toString()));

    proc.on("close", (code) => {
        console.log(`Emulator exited with code ${code}`);

        stop();
    });

    currentPid = proc.pid;
}

export const start = (gameFile) => {
    const ext = gameFile.split(".").pop();
    const core = cores.find(core => core.extensions.includes(ext));

    if (!core) {
        console.error("No core found for this file extension");
        return;
    }

    startEmulator(core.core, gameFile);
}

export const startById = (gameId) => {
    const gameFile = fs.readdirSync("./data/roms").find(file => file.startsWith(gameId));

    if (!gameFile) {
        console.error("Game not found");
        return;
    }

    start(`./data/roms/${gameFile}`);
}

export const stop = () => {
    if (currentPid && isRunning(currentPid)) {
        terminate(currentPid, () => {
            console.log("Emulator closed");
        });
    }

    currentPid = null;

    return true;
}

export const getAllCores = () => {
    return cores;
};