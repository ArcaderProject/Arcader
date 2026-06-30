use std::collections::HashSet;

use rusqlite::Connection;

const MIGRATIONS: &[(&str, &str)] = &[
    (
        "0001-create-config",
        include_str!("sql/0001-create-config.sql"),
    ),
    ("0002-create-roms", include_str!("sql/0002-create-roms.sql")),
    (
        "0003-create-game-lists",
        include_str!("sql/0003-create-game-lists.sql"),
    ),
    (
        "0004-create-save-folders",
        include_str!("sql/0004-create-save-folders.sql"),
    ),
];

fn ensure_migrations_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS migrations
            (
                id         TEXT PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
    )
}

fn applied_ids(conn: &Connection) -> rusqlite::Result<HashSet<String>> {
    let mut stmt = conn.prepare("SELECT id FROM migrations")?;
    let ids = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<HashSet<String>>>()?;
    Ok(ids)
}

pub fn run_migrations(conn: &mut Connection) -> rusqlite::Result<()> {
    ensure_migrations_table(conn)?;
    let applied = applied_ids(conn)?;

    for (id, sql) in MIGRATIONS {
        if applied.contains(*id) {
            continue;
        }

        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute("INSERT INTO migrations (id) VALUES (?);", [id])?;
        tx.commit()?;

        println!("Applied migration: {}", id);
    }

    Ok(())
}
