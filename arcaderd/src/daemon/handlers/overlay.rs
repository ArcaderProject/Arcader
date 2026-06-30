pub const RESUME_GAME_MESSAGE_TYPE: &str = "RESUME_GAME";
pub const EXIT_GAME_MESSAGE_TYPE: &str = "EXIT_GAME";

pub fn handle_resume_game() {
    crate::overlay::close();
}

pub fn handle_exit_game() {
    crate::overlay::exit_game();
}
