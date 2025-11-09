import { startDaemonSocket } from "./daemon/DaemonSocket.js";
import { startServer } from "./api/index.js";
import { runRetroArchTask } from "./tasks/retroarchTask.js";
import {connectToDatabase, runMigrations} from "./utils/databaseUtils.js";
import {reloadCores} from "./utils/emulationUtils.js";

connectToDatabase();
runMigrations();

runRetroArchTask()
    .then((result) => {
        if (!result.success) {
            console.error("RetroArch setup failed:", result.message);
        }
        reloadCores();
    })
    .catch((error) => {
        console.error("Fatal error during RetroArch setup:", error);
    });

startDaemonSocket();
startServer();
