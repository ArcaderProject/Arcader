CREATE TABLE IF NOT EXISTS game_lists
(
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    type       TEXT NOT NULL CHECK (type IN ('include', 'exclude')),
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_list_items
(
    list_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    PRIMARY KEY (list_id, game_id),
    FOREIGN KEY (list_id) REFERENCES game_lists (id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES roms (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_list_items_list_id ON game_list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_game_list_items_game_id ON game_list_items (game_id);

INSERT INTO game_lists (id, name, type, is_default)
VALUES ('default', 'Default (All Games)', 'exclude', 1);

INSERT OR IGNORE INTO config (key, value)
VALUES ('selected_list_id', 'default');
