import { Database } from "bun:sqlite";
import path from "path";
import { ensureDataDirectories } from "./directoryUtils.js";
import { migrations } from "../migrations";

const DATABASE_PATH = path.join(process.cwd(), "data", "app.db");

let db;

export const connectToDatabase = () => {
    ensureDataDirectories();

    db = new Database(DATABASE_PATH);
    console.log("Connected to database");
};

export const ensureMigrationsTable = () => {
    db.run(`CREATE TABLE IF NOT EXISTS migrations
            (
                id         TEXT PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );`);
};

export const runMigrations = () => {
    ensureMigrationsTable();

    const appliedRows = db.query("SELECT id FROM migrations").all();
    const appliedMigrations = new Set(appliedRows.map((row) => row.id));

    for (const migration of migrations) {
        const migrationId = migration.id;

        if (appliedMigrations.has(migrationId)) continue;

        if (typeof migration.module.up !== "function") {
            console.warn(`Migration ${migrationId} does not export an 'up' function`);
            continue;
        }

        migration.module.up(db);
        console.log(`Applied migration: ${migrationId}`);

        db.run(`INSERT INTO migrations (id) VALUES (?);`, migrationId);
    }
};

export const getDatabase = () => db;
