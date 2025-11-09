import { sendResponse } from "../DaemonSocket.js";
import { getFilteredGames, getCoverArtBase64 } from "../../utils/gamesUtils.js";

export const GET_GAMES_MESSAGE_TYPE = "GET_GAMES";

export const handleGetGames = (socket, requestId) => {
    try {
        const games = getFilteredGames();

        const formattedGames = games.map((game) => ({
            id: game.id,
            name: game.name,
            console: game.console,
            extension: game.extension,
            filename: game.filename,
            cover_art: game.cover_art === 1,
            cover_data: getCoverArtBase64(game.id),
        }));

        sendResponse(socket, {
            requestId,
            type: "GET_GAMES_RESPONSE",
            success: true,
            data: { games: formattedGames },
        });
    } catch (error) {
        console.error("Error getting games:", error);
        sendResponse(socket, {
            requestId,
            type: "GET_GAMES_RESPONSE",
            success: false,
            error: error.message,
        });
    }
};
