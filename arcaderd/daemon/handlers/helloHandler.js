import { sendResponse } from "../DaemonSocket.js";

export const HELLO_MESSAGE_TYPE = "HELLO";

export const handleSayHello = (socket, requestId) => {
    sendResponse(socket, { requestId, type: "HELLO_RESPONSE", success: true, data: undefined });
};
