import {getDatabase} from "./databaseUtils.js";
import fs from "fs";
import path from "path";
import {randomUUID} from "crypto";

const SAVES_BASE_PATH = path.join(process.cwd(), "data", "saves");
const GLOBAL_PROFILE_UUID = "global";
const GLOBAL_PROFILE_NAME = "Global";

const ensureSavesDirectory = () => {
    if (!fs.existsSync(SAVES_BASE_PATH)) fs.mkdirSync(SAVES_BASE_PATH, {recursive: true});
};

export const ensureGlobalProfile = () => {
    ensureSavesDirectory();

    const db = getDatabase();
    const existing = db.query("SELECT * FROM save_folders WHERE uuid = ?").get(GLOBAL_PROFILE_UUID);

    if (!existing) {
        db.run(
            `INSERT INTO save_folders (uuid, name, isLocked, isActive, isDefault)
             VALUES (?, ?, 0, 1, 1)`,
            [GLOBAL_PROFILE_UUID, GLOBAL_PROFILE_NAME]
        );
        console.log("Created global save profile");
    }

    const globalPath = path.join(SAVES_BASE_PATH, GLOBAL_PROFILE_UUID);
    if (!fs.existsSync(globalPath)) {
        fs.mkdirSync(globalPath, {recursive: true});
    }
};

export const getAllSaveFolders = () => {
    const db = getDatabase();
    const folders = db.query("SELECT * FROM save_folders ORDER BY isDefault DESC, created_at ASC").all();

    return folders.map(folder => ({
        uuid: folder.uuid,
        name: folder.name,
        isLocked: Boolean(folder.isLocked),
        isActive: Boolean(folder.isActive),
        isDefault: Boolean(folder.isDefault),
        createdAt: folder.created_at
    }));
};

export const getSaveFolder = (uuid) => {
    const db = getDatabase();
    const folder = db.query("SELECT * FROM save_folders WHERE uuid = ?").get(uuid);

    if (!folder) return null;

    return {
        uuid: folder.uuid,
        name: folder.name,
        isLocked: Boolean(folder.isLocked),
        isActive: Boolean(folder.isActive),
        isDefault: Boolean(folder.isDefault),
        createdAt: folder.created_at
    };
};

/**
 * Get the currently active save folder
 * @returns {Object|null} The active save folder
 */
export const getActiveSaveFolder = () => {
    const db = getDatabase();
    const folder = db.query("SELECT * FROM save_folders WHERE isActive = 1").get();

    if (!folder) {
        ensureGlobalProfile();
        return getSaveFolder(GLOBAL_PROFILE_UUID);
    }

    return {
        uuid: folder.uuid,
        name: folder.name,
        isLocked: Boolean(folder.isLocked),
        isActive: Boolean(folder.isActive),
        isDefault: Boolean(folder.isDefault),
        createdAt: folder.created_at
    };
};

export const createSaveFolder = (name) => {
    ensureSavesDirectory();

    const db = getDatabase();
    const uuid = randomUUID();

    db.run(
        `INSERT INTO save_folders (uuid, name, isLocked, isActive, isDefault)
         VALUES (?, ?, 0, 0, 0)`,
        [uuid, name]
    );

    const folderPath = path.join(SAVES_BASE_PATH, uuid);
    fs.mkdirSync(folderPath, {recursive: true});

    return getSaveFolder(uuid);
};

export const renameSaveFolder = (uuid, name) => {
    const db = getDatabase();

    if (uuid === GLOBAL_PROFILE_UUID) throw new Error("Cannot rename global profile");


    db.run("UPDATE save_folders SET name = ? WHERE uuid = ?", [name, uuid]);

    return getSaveFolder(uuid);
};

export const setActiveSaveFolder = (uuid) => {
    const db = getDatabase();

    const folder = getSaveFolder(uuid);
    if (!folder) throw new Error("Save folder not found");

    db.run("UPDATE save_folders SET isActive = 0");

    db.run("UPDATE save_folders SET isActive = 1 WHERE uuid = ?", [uuid]);

    return getSaveFolder(uuid);
};

export const lockSaveFolder = (uuid) => {
    const db = getDatabase();

    db.run("UPDATE save_folders SET isLocked = 1 WHERE uuid = ?", [uuid]);

    return getSaveFolder(uuid);
};

export const unlockSaveFolder = (uuid) => {
    const db = getDatabase();

    db.run("UPDATE save_folders SET isLocked = 0 WHERE uuid = ?", [uuid]);

    return getSaveFolder(uuid);
};

export const clearSaveFolder = (uuid) => {
    const folder = getSaveFolder(uuid);
    if (!folder) throw new Error("Save folder not found");
    if (folder.isLocked) throw new Error("Cannot clear a locked save folder");

    const folderPath = path.join(SAVES_BASE_PATH, uuid);

    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                const stats = fs.statSync(filePath);

                if (stats.isFile()) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    console.log(`Deleted file: ${filePath}`);
                } else if (stats.isDirectory()) {
                    fs.rmSync(filePath, {recursive: true, force: true});
                    deletedCount++;
                    console.log(`Deleted directory: ${filePath}`);
                }
            } catch (error) {
                console.error(`Failed to delete ${filePath}:`, error);
            }
        }

        console.log(`Cleared ${deletedCount} items from save folder ${uuid} (${folder.name})`);
        return {deletedCount};
    }

    console.log(`Save folder ${uuid} does not exist on disk`);
    return {deletedCount: 0};
};

export const deleteSaveFolder = (uuid) => {
    const db = getDatabase();

    if (uuid === GLOBAL_PROFILE_UUID) throw new Error("Cannot delete global profile");

    const folder = getSaveFolder(uuid);
    if (!folder) throw new Error("Save folder not found");

    if (folder.isActive) setActiveSaveFolder(GLOBAL_PROFILE_UUID);


    db.run("DELETE FROM save_folders WHERE uuid = ?", [uuid]);

    const folderPath = path.join(SAVES_BASE_PATH, uuid);
    if (fs.existsSync(folderPath)) {
        try {
            fs.rmSync(folderPath, {recursive: true, force: true});
        } catch (error) {
            console.error(`Failed to delete folder ${uuid}:`, error);
        }
    }
};

export const getSaveFolderPath = (uuid) => {
    return path.join(SAVES_BASE_PATH, uuid);
};
