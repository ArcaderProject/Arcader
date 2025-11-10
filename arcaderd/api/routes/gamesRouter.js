import express from "express";
import multer from "multer";
import {
    addGame,
    getAllGames,
    getGameById,
    updateGameName,
    updateGameCore,
    deleteGame,
    uploadCoverArt,
    getCoverArtPath,
} from "../../utils/gamesUtils.js";
import {
    startByFilename,
    getCurrentGame,
    getCoresForExtension,
    stop,
} from "../../utils/emulationUtils.js";
import {
    lookupGameId,
    getGameCovers,
    downloadCoverByUrl,
} from "../../utils/loaderUtils.js";
import { getDatabase } from "../../utils/databaseUtils.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/", (req, res) => {
    try {
        const games = getAllGames();
        res.json(games);
    } catch (error) {
        console.error("Error fetching games:", error);
        res.status(500).json({ error: "Failed to fetch games" });
    }
});

router.get("/:id", (req, res) => {
    try {
        const game = getGameById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }
        res.json(game);
    } catch (error) {
        console.error("Error fetching game:", error);
        res.status(500).json({ error: "Failed to fetch game" });
    }
});

router.post("/", upload.single("rom"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const originalFilename = req.file.originalname;
        const fileBuffer = req.file.buffer;
        const gameName = req.body.name || null;

        const game = addGame(originalFilename, fileBuffer, gameName);
        res.status(201).json(game);
    } catch (error) {
        console.error("Error uploading game:", error);
        if (error.message.includes("Unsupported file extension")) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Failed to upload game" });
    }
});

router.put("/:id", (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name is required" });

        const updated = updateGameName(req.params.id, name);
        if (!updated) {
            return res.status(404).json({ error: "Game not found" });
        }

        const game = getGameById(req.params.id);
        res.json(game);
    } catch (error) {
        console.error("Error updating game:", error);
        res.status(500).json({ error: "Failed to update game" });
    }
});

router.put("/:id/core", (req, res) => {
    try {
        const { core } = req.body;
        if (!core) return res.status(400).json({ error: "Core is required" });

        const updated = updateGameCore(req.params.id, core);
        if (!updated) return res.status(404).json({ error: "Game not found" });

        const game = getGameById(req.params.id);
        res.json(game);
    } catch (error) {
        console.error("Error updating game core:", error);
        res.status(500).json({ error: "Failed to update game core" });
    }
});

router.get("/:id/cores", (req, res) => {
    try {
        const game = getGameById(req.params.id);
        if (!game) return res.status(404).json({ error: "Game not found" });

        const cores = getCoresForExtension(game.extension);
        res.json(cores);
    } catch (error) {
        console.error("Error fetching cores:", error);
        res.status(500).json({ error: "Failed to fetch cores" });
    }
});

router.delete("/:id", (req, res) => {
    try {
        const deleted = deleteGame(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: "Game not found" });
        }
        res.json({ message: "Game deleted successfully" });
    } catch (error) {
        console.error("Error deleting game:", error);
        res.status(500).json({ error: "Failed to delete game" });
    }
});

router.post("/:id/cover", upload.single("cover"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const uploaded = uploadCoverArt(req.params.id, req.file.buffer);
        if (!uploaded) {
            return res.status(404).json({ error: "Game not found" });
        }

        res.json({ message: "Cover art uploaded successfully" });
    } catch (error) {
        console.error("Error uploading cover art:", error);
        res.status(500).json({ error: "Failed to upload cover art" });
    }
});

router.get("/:id/cover", (req, res) => {
    try {
        const coverPath = getCoverArtPath(req.params.id);
        if (!coverPath) {
            return res.status(404).json({ error: "Cover art not found" });
        }

        res.sendFile(coverPath);
    } catch (error) {
        console.error("Error fetching cover art:", error);
        res.status(500).json({ error: "Failed to fetch cover art" });
    }
});

router.get("/:id/lookup-covers", async (req, res) => {
    try {
        const game = getGameById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }

        const steamGameId = await lookupGameId(game.name);
        if (!steamGameId) {
            return res.status(404).json({ error: "No matching game found on SteamGridDB" });
        }

        const covers = await getGameCovers(steamGameId, 10);
        res.json({ steamGameId, covers });
    } catch (error) {
        console.error("Error looking up covers:", error);
        if (error.message.includes("API key")) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Failed to lookup covers" });
    }
});

router.post("/:id/cover-from-url", async (req, res) => {
    try {
        const { coverUrl } = req.body;
        if (!coverUrl) {
            return res.status(400).json({ error: "Cover URL is required" });
        }

        const game = getGameById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }

        const success = await downloadCoverByUrl(coverUrl, req.params.id);
        if (!success) {
            return res.status(500).json({ error: "Failed to download cover" });
        }

        const db = getDatabase();
        const stmt = db.prepare("UPDATE roms SET cover_art = 1 WHERE id = ?");
        stmt.run(req.params.id);

        res.json({ message: "Cover art updated successfully" });
    } catch (error) {
        console.error("Error updating cover from URL:", error);
        res.status(500).json({ error: "Failed to update cover" });
    }
});

router.post("/:id/start", (req, res) => {
    try {
        const game = getGameById(req.params.id);
        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }

        const started = startByFilename(game.filename, {
            id: game.id,
            name: game.name,
            console: game.console,
            filename: game.filename,
            core: game.core,
        });

        if (!started) {
            return res.status(409).json({ error: "Emulator already running" });
        }

        res.json({ message: "Game started successfully", game });
    } catch (error) {
        console.error("Error starting game:", error);
        res.status(500).json({ error: "Failed to start game" });
    }
});

router.get("/playing/current", (req, res) => {
    try {
        const currentGame = getCurrentGame();
        if (!currentGame) {
            return res.json({ playing: false, game: null });
        }

        res.json({ playing: true, game: currentGame });
    } catch (error) {
        console.error("Error fetching current game:", error);
        res.status(500).json({ error: "Failed to fetch current game" });
    }
});

router.post("/playing/stop", (req, res) => {
    try {
        stop();
        res.json({ message: "Game stopped successfully" });
    } catch (error) {
        console.error("Error stopping game:", error);
        res.status(500).json({ error: "Failed to stop game" });
    }
});

export default router;
