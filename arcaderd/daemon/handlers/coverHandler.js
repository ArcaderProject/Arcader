import { sendResponse } from "../DaemonSocket.js";
import { getCoverArtBase64 } from "../../utils/gamesUtils.js";

export const GET_COVER_MESSAGE_TYPE = "GET_COVER";

export const handleGetCover = (socket, requestId, data) => {
    try {
        const { gameId } = data;

        if (!gameId) {
            sendResponse(socket, {
                requestId,
                type: "GET_COVER_RESPONSE",
                success: false,
                error: "Game ID is required",
            });
            return;
        }

        const coverData = getCoverArtBase64(gameId);

        sendResponse(socket, {
            requestId,
            type: "GET_COVER_RESPONSE",
            success: true,
            data: {
                gameId,
                coverData,
            },
        });
    } catch (error) {
        console.error("Error getting cover art:", error);
        sendResponse(socket, {
            requestId,
            type: "GET_COVER_RESPONSE",
            success: false,
            error: error.message,
        });
    }
};
