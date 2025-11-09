/**
 * @param db {import("bun:sqlite").Database}
 */
export const up = async (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS config
            (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
    `);
}