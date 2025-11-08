import { HELLO_MESSAGE_TYPE, handleSayHello } from "./helloHandler.js";

export const messageHandlers = {
    [HELLO_MESSAGE_TYPE]: handleSayHello,
};
