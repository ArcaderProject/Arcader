pub mod coin;
pub mod cover;
pub mod games;
pub mod hello;
pub mod start_game;

use serde_json::Value;

use crate::daemon::socket::ClientHandle;

pub async fn dispatch(
    message_type: &str,
    handle: &ClientHandle,
    request_id: Value,
    data: Value,
) -> bool {
    match message_type {
        hello::HELLO_MESSAGE_TYPE => {
            hello::handle_say_hello(handle, request_id);
            true
        }
        games::GET_GAMES_MESSAGE_TYPE => {
            games::handle_get_games(handle, request_id);
            true
        }
        start_game::START_GAME_MESSAGE_TYPE => {
            start_game::handle_start_game(handle, request_id, data).await;
            true
        }
        cover::GET_COVER_MESSAGE_TYPE => {
            cover::handle_get_cover(handle, request_id, data);
            true
        }
        coin::GET_COIN_STATUS_MESSAGE_TYPE => {
            coin::handle_get_coin_status(handle, request_id);
            true
        }
        coin::SET_FREE_PLAY_MESSAGE_TYPE => {
            coin::handle_set_free_play(handle, request_id, data);
            true
        }
        _ => false,
    }
}
