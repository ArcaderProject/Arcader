/**
 * @param db {import("bun:sqlite").Database}
 */
export const up = async (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS game_lists
            (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL UNIQUE,
                type       TEXT NOT NULL CHECK (type IN ('include', 'exclude')),
                is_default INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
    `);

    db.run(`CREATE TABLE IF NOT EXISTS game_list_items
            (
                list_id TEXT NOT NULL,
                game_id TEXT NOT NULL,
                PRIMARY KEY (list_id, game_id),
                FOREIGN KEY (list_id) REFERENCES game_lists (id) ON DELETE CASCADE,
                FOREIGN KEY (game_id) REFERENCES roms (id) ON DELETE CASCADE
            );
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_game_list_items_list_id ON game_list_items (list_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_game_list_items_game_id ON game_list_items (game_id);`);

    db.run(`INSERT INTO game_lists (id, name, type, is_default)
            VALUES ('default', 'Default (All Games)', 'exclude', 1);
    `);

    const configCheck = db.query(`SELECT value FROM config WHERE key = 'selected_list_id'`).get();
    if (!configCheck) {
        db.run(`INSERT INTO config (key, value) VALUES ('selected_list_id', 'default');`);
    }
};
