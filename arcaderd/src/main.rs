mod api;
mod coin;
mod daemon;
mod migrations;
mod overlay;
mod tasks;
mod usb;
mod utils;

use crate::api::start_server;
use crate::daemon::socket::start_daemon_socket;
use crate::tasks::cores::run_cores_task;
use crate::tasks::retroarch::run_retro_arch_task;
use crate::utils::config::initialize_admin_password;
use crate::utils::database::{connect_to_database, run_migrations};
use crate::utils::emulation::reload_cores;
use crate::utils::game_saves::ensure_global_profile;

#[tokio::main]
async fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("coin-selftest") => {
            coin::selftest();
            return;
        }
        Some("coin-flash") => {
            coin::force_flash();
            return;
        }
        _ => {}
    }

    connect_to_database();
    run_migrations();

    initialize_admin_password();
    ensure_global_profile();

    tokio::spawn(async {
        let result = run_retro_arch_task().await;
        if !result.success {
            eprintln!("RetroArch setup failed: {}", result.message);
            return;
        }

        let result = run_cores_task().await;
        if !result.success {
            eprintln!("Cores setup failed: {}", result.message);
        }

        reload_cores();
    });

    tokio::spawn(async {
        start_daemon_socket().await;
    });

    coin::start();
    overlay::start();
    usb::start();

    tokio::spawn(coin::run_timer());

    tokio::spawn(async {
        crate::utils::frontends::bootstrap().await;
    });
    crate::utils::frontends::start_supervisor();

    start_server().await;
}
