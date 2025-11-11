import express from "express";
import {
    getAllSaveFolders,
    createSaveFolder,
    renameSaveFolder,
    setActiveSaveFolder,
    lockSaveFolder,
    unlockSaveFolder,
    clearSaveFolder,
    deleteSaveFolder,
} from "../../utils/gameSavesUtils.js";

const router = express.Router();

router.get("/", (req, res) => {
    try {
        const folders = getAllSaveFolders();
        res.json(folders);
    } catch (error) {
        console.error("Error fetching save folders:", error);
        res.status(500).json({ error: "Failed to fetch save folders" });
    }
});

router.post("/", (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Name is required" });
        }
        
        const folder = createSaveFolder(name.trim());
        res.status(201).json(folder);
    } catch (error) {
        console.error("Error creating save folder:", error);
        res.status(500).json({ error: "Failed to create save folder" });
    }
});

router.put("/:uuid", (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Name is required" });
        }
        
        const folder = renameSaveFolder(req.params.uuid, name.trim());
        res.json(folder);
    } catch (error) {
        console.error("Error updating save folder:", error);
        
        if (error.message === "Cannot rename global profile") {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ error: "Failed to update save folder" });
    }
});

router.post("/:uuid/activate", (req, res) => {
    try {
        const folder = setActiveSaveFolder(req.params.uuid);
        res.json(folder);
    } catch (error) {
        console.error("Error activating save folder:", error);
        
        if (error.message === "Save folder not found") {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: "Failed to activate save folder" });
    }
});

router.post("/:uuid/lock", (req, res) => {
    try {
        const folder = lockSaveFolder(req.params.uuid);
        res.json(folder);
    } catch (error) {
        console.error("Error locking save folder:", error);
        res.status(500).json({ error: "Failed to lock save folder" });
    }
});

router.post("/:uuid/unlock", (req, res) => {
    try {
        const folder = unlockSaveFolder(req.params.uuid);
        res.json(folder);
    } catch (error) {
        console.error("Error unlocking save folder:", error);
        res.status(500).json({ error: "Failed to unlock save folder" });
    }
});

router.post("/:uuid/clear", (req, res) => {
    try {
        const result = clearSaveFolder(req.params.uuid);
        res.json({ 
            success: true,
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error("Error clearing save folder:", error);
        
        if (error.message === "Save folder not found") {
            return res.status(404).json({ error: error.message });
        }
        
        if (error.message === "Cannot clear a locked save folder") {
            return res.status(403).json({ error: error.message });
        }
        
        res.status(500).json({ error: "Failed to clear save folder" });
    }
});

router.delete("/:uuid", (req, res) => {
    try {
        deleteSaveFolder(req.params.uuid);
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting save folder:", error);
        
        if (error.message === "Cannot delete global profile") {
            return res.status(403).json({ error: error.message });
        }
        
        if (error.message === "Save folder not found") {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: "Failed to delete save folder" });
    }
});

export default router;
