use once_cell::sync::OnceCell;
use rusqlite::types::{ToSql, ValueRef};
use rusqlite::Connection;
use serde_json::{Map, Value};
use std::sync::{Mutex, MutexGuard};

use crate::utils::directory::ensure_data_directories;
use crate::utils::paths::cwd;

static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

fn database_path() -> std::path::PathBuf {
    cwd().join("data").join("app.db")
}

pub fn connect_to_database() {
    ensure_data_directories(&cwd());

    let conn = Connection::open(database_path()).expect("Failed to open database");
    DB.set(Mutex::new(conn))
        .map_err(|_| ())
        .expect("Database already initialized");
    println!("Connected to database");
}

pub fn get_database() -> MutexGuard<'static, Connection> {
    DB.get()
        .expect("Database not initialized")
        .lock()
        .unwrap()
}

pub fn run_migrations() {
    let mut db = get_database();
    crate::migrations::run_migrations(&mut db).expect("Failed to run migrations");
}

fn row_to_json(row: &rusqlite::Row, columns: &[String]) -> Map<String, Value> {
    let mut obj = Map::new();
    for (i, name) in columns.iter().enumerate() {
        let value = match row.get_ref(i).unwrap() {
            ValueRef::Null => Value::Null,
            ValueRef::Integer(n) => Value::from(n),
            ValueRef::Real(f) => Value::from(f),
            ValueRef::Text(t) => Value::from(String::from_utf8_lossy(t).into_owned()),
            ValueRef::Blob(b) => Value::from(b.to_vec()),
        };
        obj.insert(name.clone(), value);
    }
    obj
}

pub fn query_json(sql: &str, params: &[&dyn ToSql]) -> Vec<Map<String, Value>> {
    let db = get_database();
    let mut stmt = db.prepare(sql).unwrap();
    let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt
        .query_map(params, |row| Ok(row_to_json(row, &columns)))
        .unwrap()
        .filter_map(Result::ok)
        .collect();
    rows
}

pub fn query_one_json(sql: &str, params: &[&dyn ToSql]) -> Option<Map<String, Value>> {
    query_json(sql, params).into_iter().next()
}

pub fn execute(sql: &str, params: &[&dyn ToSql]) -> usize {
    let db = get_database();
    db.execute(sql, params).unwrap()
}

pub fn try_execute(sql: &str, params: &[&dyn ToSql]) -> Result<usize, String> {
    let db = get_database();
    db.execute(sql, params).map_err(|e| e.to_string())
}

pub fn with_transaction<T>(
    f: impl FnOnce(&rusqlite::Transaction) -> rusqlite::Result<T>,
) -> Result<T, String> {
    let mut db = get_database();
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let result = f(&tx).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(result)
}
