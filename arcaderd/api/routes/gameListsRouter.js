import express from "express";
import { getDatabase } from "../../utils/databaseUtils.js";
import { getConfig, setConfig } from "../../utils/configUtils.js";
import crypto from "crypto";

const CONFIG_KEY = "selected_list_id";

const router = express.Router();

router.get("/", (req, res) => {
    try {
        const db = getDatabase();
        const stmt = db.prepare(`
            SELECT gl.*,
                   (SELECT COUNT(*) FROM game_list_items WHERE list_id = gl.id) as item_count
            FROM game_lists gl
            ORDER BY is_default DESC, name
        `);
        const lists = stmt.all();
        res.json(lists);
    } catch (error) {
        console.error("Error fetching game lists:", error);
        res.status(500).json({ error: "Failed to fetch game lists" });
    }
});

router.get("/selected", (req, res) => {
    try {
        const db = getDatabase();
        const selectedListId = getConfig(CONFIG_KEY, "default");

        const stmt = db.prepare(`SELECT * FROM game_lists WHERE id = ?`);
        const list = stmt.get(selectedListId);

        if (!list) return res.status(404).json({ error: "Selected list not found" });

        res.json(list);
    } catch (error) {
        console.error("Error fetching selected list:", error);
        res.status(500).json({ error: "Failed to fetch selected list" });
    }
});

router.post("/selected", (req, res) => {
    try {
        const { listId } = req.body;
        if (!listId) return res.status(400).json({ error: "List ID is required" });

        const db = getDatabase();

        const listStmt = db.prepare(`SELECT * FROM game_lists WHERE id = ?`);
        const list = listStmt.get(listId);
        if (!list) return res.status(404).json({ error: "List not found" });

        setConfig(CONFIG_KEY, listId);

        res.json({ message: "Selected list updated successfully", list });
    } catch (error) {
        console.error("Error setting selected list:", error);
        res.status(500).json({ error: "Failed to set selected list" });
    }
});

router.post("/", (req, res) => {
    try {
        const { name, type } = req.body;

        if (!name || !type) return res.status(400).json({ error: "Name and type are required" });

        if (!["include", "exclude"].includes(type))
            return res.status(400).json({ error: "Type must be 'include' or 'exclude'" });

        const db = getDatabase();
        const id = crypto.randomBytes(16).toString("hex");

        const stmt = db.prepare(`
            INSERT INTO game_lists (id, name, type, is_default)
            VALUES (?, ?, ?, 0)
        `);

        try {
            stmt.run(id, name, type);
        } catch (error) {
            if (error.message.includes("UNIQUE constraint failed"))
                return res.status(400).json({ error: "A list with this name already exists" });

            throw error;
        }

        const newList = db.prepare(`SELECT * FROM game_lists WHERE id = ?`).get(id);
        res.status(201).json(newList);
    } catch (error) {
        console.error("Error creating game list:", error);
        res.status(500).json({ error: "Failed to create game list" });
    }
});

router.put("/:id", (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) return res.status(400).json({ error: "Name is required" });

        const db = getDatabase();

        const checkStmt = db.prepare(`SELECT is_default FROM game_lists WHERE id = ?`);
        const list = checkStmt.get(id);

        if (!list) return res.status(404).json({ error: "List not found" });
        if (list.is_default) return res.status(403).json({ error: "Cannot edit the default list" });

        const stmt = db.prepare(`UPDATE game_lists SET name = ? WHERE id = ?`);

        try {
            stmt.run(name, id);
        } catch (error) {
            if (error.message.includes("UNIQUE constraint failed"))
                return res.status(400).json({ error: "A list with this name already exists" });

            throw error;
        }

        const updatedList = db.prepare(`SELECT * FROM game_lists WHERE id = ?`).get(id);
        res.json(updatedList);
    } catch (error) {
        console.error("Error updating game list:", error);
        res.status(500).json({ error: "Failed to update game list" });
    }
});

router.delete("/:id", (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const checkStmt = db.prepare(`SELECT is_default FROM game_lists WHERE id = ?`);
        const list = checkStmt.get(id);

        if (!list) return res.status(404).json({ error: "List not found" });
        if (list.is_default)
            return res.status(403).json({ error: "Cannot delete the default list" });

        const selectedListId = getConfig(CONFIG_KEY, "default");
        if (selectedListId === id) {
            setConfig(CONFIG_KEY, "default");
        }

        const stmt = db.prepare(`DELETE FROM game_lists WHERE id = ?`);
        stmt.run(id);

        res.json({ message: "List deleted successfully" });
    } catch (error) {
        console.error("Error deleting game list:", error);
        res.status(500).json({ error: "Failed to delete game list" });
    }
});

router.get("/:id/games", (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const listStmt = db.prepare(`SELECT * FROM game_lists WHERE id = ?`);
        const list = listStmt.get(id);

        if (!list) return res.status(404).json({ error: "List not found" });

        const itemsStmt = db.prepare(`SELECT game_id FROM game_list_items WHERE list_id = ?`);
        const items = itemsStmt.all(id);
        const gameIds = items.map((item) => item.game_id);

        res.json({ gameIds, type: list.type });
    } catch (error) {
        console.error("Error fetching games in list:", error);
        res.status(500).json({ error: "Failed to fetch games in list" });
    }
});

router.put("/:id/games", (req, res) => {
    try {
        const { id } = req.params;
        const { gameIds } = req.body;

        if (!Array.isArray(gameIds)) {
            return res.status(400).json({ error: "gameIds must be an array" });
        }

        const db = getDatabase();

        const checkStmt = db.prepare(`SELECT is_default FROM game_lists WHERE id = ?`);
        const list = checkStmt.get(id);

        if (!list) return res.status(404).json({ error: "List not found" });

        if (list.is_default)
            return res.status(403).json({ error: "Cannot edit games in the default list" });

        db.prepare(`DELETE FROM game_list_items WHERE list_id = ?`).run(id);

        if (gameIds.length > 0) {
            const insertStmt = db.prepare(`INSERT INTO game_list_items (list_id, game_id)
                                           VALUES (?, ?)`);

            for (const gameId of gameIds) insertStmt.run(id, gameId);
        }

        res.json({ message: "Games updated successfully", count: gameIds.length });
    } catch (error) {
        console.error("Error updating games in list:", error);
        res.status(500).json({ error: "Failed to update games in list" });
    }
});

export default router;
