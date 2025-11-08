import { sendResponse } from "../DaemonSocket.js";

export const HELLO_MESSAGE_TYPE = "HELLO";

export const handleSayHello = (socket, requestId, data) => {
    const client = data?.client || "World";
    console.log(`Got HELLO request from ${socket.remoteAddress} with name: ${client}`);

    sendResponse(socket, { requestId, type: "HELLO_RESPONSE", success: true, data: undefined });
};
