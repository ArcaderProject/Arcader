import { startByFilename, getCurrentGame } from "../../utils/emulationUtils.js";
import { getAllGames } from "../../utils/gamesUtils.js";
import { sendResponse, broadcastToAll } from "../DaemonSocket.js";

export const START_GAME_MESSAGE_TYPE = "START_GAME";

export const broadcastUpdateScreen = (screen) => {
    broadcastToAll({ type: "UPDATE_SCREEN", data: { screen } });
};

export const handleStartGame = async (socket, requestId, data) => {
    try {
        if (!data?.gameUuid) throw new Error("Game ID is required");
        const games = await getAllGames();
        const game = games.find((g) => g.id === data.gameUuid);

        if (!game) throw new Error("Game not found");
        if (getCurrentGame()) throw new Error("A game is already running");
        if (!startByFilename(game.filename, game)) throw new Error("Failed to start game");

        sendResponse(socket, {
            requestId,
            type: "START_GAME_RESPONSE",
            data: {
                success: true,
                game: { id: game.id, name: game.name, filename: game.filename },
            },
        });
    } catch (error) {
        console.error("Error starting game:", error);
        sendResponse(socket, { requestId, type: "START_GAME_ERROR", error: error.message });
    }
};
