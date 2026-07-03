use crate::controller::session;

pub const CONFIG_SKIP_MESSAGE_TYPE: &str = "CONFIG_SKIP";
pub const CONFIG_CANCEL_MESSAGE_TYPE: &str = "CONFIG_CANCEL";

pub fn handle_config_skip() {
    session::skip();
}

pub fn handle_config_cancel() {
    session::cancel();
}
