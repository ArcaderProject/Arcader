import { startDaemonSocket } from "./daemon/DaemonSocket.js";
import { startServer } from "./api/index.js";
import { runRetroArchTask } from "./tasks/retroarchTask.js";
import { runCoresTask } from "./tasks/coresTask.js";
import { connectToDatabase, runMigrations } from "./utils/databaseUtils.js";
import { reloadCores } from "./utils/emulationUtils.js";
import { initializeAdminPassword } from "./utils/configUtils.js";
import { ensureGlobalProfile } from "./utils/gameSavesUtils.js";

connectToDatabase();
runMigrations();

initializeAdminPassword();
ensureGlobalProfile();

runRetroArchTask()
    .then((result) => {
        if (!result.success) {
            console.error("RetroArch setup failed:", result.message);
            return;
        }

        return runCoresTask();
    })
    .then((result) => {
        if (result && !result.success) {
            console.error("Cores setup failed:", result.message);
        }

        reloadCores();
    })
    .catch((error) => {
        console.error("Fatal error during setup:", error);
    });

startDaemonSocket();
startServer();
