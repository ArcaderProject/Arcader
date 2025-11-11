/**
 * @param db {import("bun:sqlite").Database}
 */
export const up = async (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS save_folders
            (
                uuid      TEXT PRIMARY KEY,
                name      TEXT NOT NULL,
                isLocked  INTEGER DEFAULT 0,
                isActive  INTEGER DEFAULT 0,
                isDefault INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
    `);
};
