import { getDatabase } from "./databaseUtils.js";
import crypto from "crypto";

const CONFIG_DEFAULTS = {
    "coinScreen.insertMessage": "INSERT COIN",
    "coinScreen.infoMessage": "Insert Coin to enter Game Library and choose a Game to play!",
    "coinScreen.konamiCodeEnabled": "false",
    "coinScreen.coinSlotEnabled": "true",
    steamGridDbApiKey: null,
};

const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const length = 16;
    let password = "";
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
        password += chars[randomBytes[i] % chars.length];
    }

    return password;
};

export const initializeAdminPassword = () => {
    if (!hasConfig("admin.password")) {
        const password = generateRandomPassword();
        setConfig("admin.password", password);
        console.log("Generated admin password:", password);
        return password;
    }
    return getConfig("admin.password");
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
