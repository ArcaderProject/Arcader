CREATE TABLE IF NOT EXISTS frontends
(
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    description       TEXT,
    repo_url          TEXT NOT NULL,
    entry             TEXT,
    entry_args        TEXT,
    compat            TEXT,
    installed_version TEXT,
    added_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
