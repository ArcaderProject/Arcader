import path from "path";
import fs from "fs";
import crypto from "crypto";
import { findCoreByExtension } from "./emulationUtils.js";
import { getDatabase } from "./databaseUtils.js";

const enrichGameWithConsole = (game) => {
    if (!game) return null;

    const core = game.core
        ? findCoreByExtension(game.extension, game.core)
        : findCoreByExtension(game.extension);

    const console = core ? core.display_name || core.systemname || "" : "";

    return { ...game, console };
};

const generateGameId = () => {
    return crypto.randomBytes(16).toString("hex");
};

export const addGame = (originalFilename, fileBuffer, gameName = null) => {
    const db = getDatabase();

    const extension = path.extname(originalFilename).toLowerCase().substring(1);

    const core = findCoreByExtension(extension);
    if (!core) throw new Error(`Unsupported file extension: ${extension}`);

    const gameId = generateGameId();
    const filename = `${gameId}.${extension}`;
    const romPath = path.join(process.cwd(), "data", "roms", filename);

    fs.writeFileSync(romPath, fileBuffer);

    const name = gameName || path.basename(originalFilename, path.extname(originalFilename));

    const stmt = db.prepare(
        "INSERT INTO roms (id, name, filename, extension, core) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(gameId, name, filename, extension, core.core);

    const console = core.display_name || core.systemname || "";

    return { id: gameId, name, filename, extension, core: core.core, console, cover_art: 0 };
};

export const getAllGames = () => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM roms ORDER BY name ASC");
    const games = stmt.all();

    return games.map(enrichGameWithConsole);
};

export const getGameById = (gameId) => {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM roms WHERE id = ?");
    const game = stmt.get(gameId);

    return enrichGameWithConsole(game);
};

export const updateGameName = (gameId, newName) => {
    const db = getDatabase();
    const stmt = db.prepare("UPDATE roms SET name = ? WHERE id = ?");
    const result = stmt.run(newName, gameId);
    return result.changes > 0;
};

export const updateGameCore = (gameId, coreName) => {
    const db = getDatabase();
    const stmt = db.prepare("UPDATE roms SET core = ? WHERE id = ?");
    const result = stmt.run(coreName, gameId);
    return result.changes > 0;
};

export const deleteGame = (gameId) => {
    const db = getDatabase();

    const game = getGameById(gameId);
    if (!game) return false;

    const romPath = path.join(process.cwd(), "data", "roms", game.filename);
    if (fs.existsSync(romPath)) fs.unlinkSync(romPath);

    if (game.cover_art) {
        const coverPath = path.join(process.cwd(), "data", "covers", `${gameId}.jpg`);
        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    const stmt = db.prepare("DELETE FROM roms WHERE id = ?");
    const result = stmt.run(gameId);
    return result.changes > 0;
};

export const uploadCoverArt = (gameId, imageBuffer) => {
    const db = getDatabase();

    const game = getGameById(gameId);
    if (!game) throw new Error("Game not found");

    const coverPath = path.join(process.cwd(), "data", "covers", `${gameId}.jpg`);
    fs.writeFileSync(coverPath, imageBuffer);

    const stmt = db.prepare("UPDATE roms SET cover_art = 1 WHERE id = ?");
    const result = stmt.run(gameId);
    return result.changes > 0;
};

export const getCoverArtPath = (gameId) => {
    const game = getGameById(gameId);
    if (!game || !game.cover_art) return null;

    const coverPath = path.join(process.cwd(), "data", "covers", `${gameId}.jpg`);
    if (fs.existsSync(coverPath)) return coverPath;

    return null;
};
