CREATE TABLE IF NOT EXISTS apps
(
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK (type IN ('web', 'native')),
    url        TEXT,
    user_agent TEXT,
    exec       TEXT,
    args       TEXT,
    icon       INTEGER DEFAULT 0,
    position   INTEGER DEFAULT 0,
    enabled    INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
