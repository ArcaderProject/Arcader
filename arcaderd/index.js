import { startDaemonSocket } from "./daemon/DaemonSocket.js";
import { startServer } from "./api/index.js";

startDaemonSocket();
startServer();
