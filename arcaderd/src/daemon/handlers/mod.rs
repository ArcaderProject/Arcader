pub mod apps;
pub mod coin;
pub mod cover;
pub mod games;
pub mod hello;
pub mod overlay;
pub mod start_game;
pub mod usb;

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
        apps::GET_APPS_MESSAGE_TYPE => {
            apps::handle_get_apps(handle, request_id);
            true
        }
        apps::GET_APP_ICON_MESSAGE_TYPE => {
            apps::handle_get_app_icon(handle, request_id, data);
            true
        }
        apps::LAUNCH_APP_MESSAGE_TYPE => {
            apps::handle_launch_app(handle, request_id, data);
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
        overlay::RESUME_GAME_MESSAGE_TYPE => {
            overlay::handle_resume_game();
            true
        }
        overlay::EXIT_GAME_MESSAGE_TYPE => {
            overlay::handle_exit_game();
            true
        }
        usb::USB_STATUS_MESSAGE_TYPE => {
            usb::handle_usb_status(handle, request_id);
            true
        }
        usb::USB_SCAN_MESSAGE_TYPE => {
            usb::handle_usb_scan(handle, request_id);
            true
        }
        usb::USB_EXPORT_MESSAGE_TYPE => {
            usb::handle_usb_export(handle, request_id, data);
            true
        }
        usb::USB_IMPORT_MESSAGE_TYPE => {
            usb::handle_usb_import(handle, request_id, data);
            true
        }
        _ => false,
    }
}
