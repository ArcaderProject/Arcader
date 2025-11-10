import { getDatabase } from "./databaseUtils.js";

const CONFIG_DEFAULTS = {
    "coinScreen.insertMessage": "INSERT COIN",
    "coinScreen.infoMessage": "Insert Coin to enter Game Library and choose a Game to play!",
    "coinScreen.konamiCodeEnabled": "false",
    "coinScreen.coinSlotEnabled": "true",
    steamGridDbApiKey: null,
};

export const getConfig = (key, defaultValue = null) => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT value FROM config WHERE key = ?");
    const result = stmt.get(key);

    if (result) return result.value;
    if (defaultValue === null && CONFIG_DEFAULTS.hasOwnProperty(key)) return CONFIG_DEFAULTS[key];

    return defaultValue;
};

export const setConfig = (key, value) => {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value) 
        VALUES (?, ?)
    `);
    stmt.run(key, value);
};

export const deleteConfig = (key) => {
    const db = getDatabase();
    const stmt = db.prepare("DELETE FROM config WHERE key = ?");
    const result = stmt.run(key);
    return result.changes > 0;
};

export const hasConfig = (key) => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT 1 FROM config WHERE key = ?");
    const result = stmt.get(key);
    return !!result;
};

export const getAllConfig = () => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT key, value FROM config");
    const rows = stmt.all();

    const config = {};
    for (const row of rows) {
        config[row.key] = row.value;
    }
    return config;
};

export const getSelectedListId = () => {
    return getConfig("selected_list_id", "default");
};
