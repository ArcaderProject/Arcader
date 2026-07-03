CREATE TABLE IF NOT EXISTS controller_profiles
(
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    is_default INTEGER DEFAULT 0,
    bindings   TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS controller_profile_games
(
    profile_id TEXT NOT NULL,
    game_id    TEXT NOT NULL,
    PRIMARY KEY (game_id),
    FOREIGN KEY (profile_id) REFERENCES controller_profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES roms (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_controller_profile_games_profile_id ON controller_profile_games (profile_id);

INSERT INTO controller_profiles (id, name, is_default)
VALUES ('default', 'Global / Default', 1);
