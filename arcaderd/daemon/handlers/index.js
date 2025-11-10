import { HELLO_MESSAGE_TYPE, handleSayHello } from "./helloHandler.js";
import { GET_GAMES_MESSAGE_TYPE, handleGetGames } from "./gamesHandler.js";
import { START_GAME_MESSAGE_TYPE, handleStartGame } from "./startGameHandler.js";
import { GET_COVER_MESSAGE_TYPE, handleGetCover } from "./coverHandler.js";

export const messageHandlers = {
    [HELLO_MESSAGE_TYPE]: handleSayHello,
    [GET_GAMES_MESSAGE_TYPE]: handleGetGames,
    [START_GAME_MESSAGE_TYPE]: handleStartGame,
    [GET_COVER_MESSAGE_TYPE]: handleGetCover,
};
