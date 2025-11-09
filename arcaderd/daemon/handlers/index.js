import { HELLO_MESSAGE_TYPE, handleSayHello } from "./helloHandler.js";
import { GET_GAMES_MESSAGE_TYPE, handleGetGames } from "./gamesHandler.js";
import { START_GAME_MESSAGE_TYPE, handleStartGame } from "./startGameHandler.js";

export const messageHandlers = {
    [HELLO_MESSAGE_TYPE]: handleSayHello,
    [GET_GAMES_MESSAGE_TYPE]: handleGetGames,
    [START_GAME_MESSAGE_TYPE]: handleStartGame,
};
