import net from "net";
import fs from "fs";
import path from "path";
import { messageHandlers } from "./handlers/index.js";

if (!process.env.XDG_RUNTIME_DIR) {
    throw new Error("XDG_RUNTIME_DIR environment variable not set");
}

const ARCADER_SOCKET_NAME = "arcaderd.sock";
const SOCKET_PATH = path.join(process.env.XDG_RUNTIME_DIR, ARCADER_SOCKET_NAME);
let server = null;
const clients = new Map();

export const sendResponse = (socket, response) => {
    try {
        const jsonResponse = JSON.stringify(response) + "\n";
        socket.write(jsonResponse);
    } catch (error) {
        console.error("Error sending response:", error);
    }
};

export const sendError = (socket, errorMessage, requestId = null) => {
    sendResponse(socket, { requestId, type: "ERROR", success: false, error: errorMessage });
};

export const handleMessage = (socket, message) => {
    const { type, requestId, data } = message;

    const handler = messageHandlers[type];
    if (handler) {
        handler(socket, requestId, data);
    } else {
        sendError(socket, `Unknown message type: ${type}`, requestId);
    }
};

export const shutdown = () => {
    console.log("Shutting down...");

    clients.forEach((socket, clientId) => {
        console.log(`Closing connection to ${clientId}`);
        socket.end();
    });

    if (server) {
        server.close(() => {
            console.log("Server closed");

            if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
            process.exit(0);
        });
    }
};

export const startDaemonSocket = () => {
    if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);

    server = net.createServer((socket) => {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        clients.set(clientId, socket);

        socket.on("data", (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(socket, message);
            } catch (error) {
                console.error("Error parsing message:", error);
                sendError(socket, "Invalid JSON format");
            }
        });

        socket.on("close", () => {
            console.log(`Client disconnected: ${clientId}`);
            clients.delete(clientId);
        });

        socket.on("error", (error) => {
            console.error(`Socket error for ${clientId}:`, error);
            clients.delete(clientId);
        });
    });

    server.listen(SOCKET_PATH, () => {
        console.log(`Game daemon started on ${SOCKET_PATH}`);
        console.log(
            `Socket directory permissions: ${fs.statSync(path.dirname(SOCKET_PATH)).mode.toString(8)}`
        );
    });

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
};
