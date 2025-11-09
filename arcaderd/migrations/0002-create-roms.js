/**
 * @param db {import("bun:sqlite").Database}
 */
export const up = async (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS roms
            (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                filename   TEXT NOT NULL UNIQUE,
                extension  TEXT NOT NULL,
                core       TEXT,
                cover_art  INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
    `);
}
