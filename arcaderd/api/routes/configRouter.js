import express from "express";
import { getConfig, setConfig } from "../../utils/configUtils.js";

const router = express.Router();

const UI_CONFIG_KEYS = [
    "coinScreen.insertMessage",
    "coinScreen.infoMessage",
    "coinScreen.konamiCodeEnabled",
    "coinScreen.coinSlotEnabled",
    "steamGridDbApiKey",
];

router.get("/", (req, res) => {
    try {
        const config = {};

        for (const key of UI_CONFIG_KEYS) {
            const value = getConfig(key);

            if (value === "true" || value === "false") {
                config[key] = value === "true";
            } else {
                config[key] = value;
            }
        }

        res.json(config);
    } catch (error) {
        console.error("Error fetching config:", error);
        res.status(500).json({ error: "Failed to fetch config" });
    }
});

router.put("/", (req, res) => {
    try {
        const updates = req.body;

        if (!updates || typeof updates !== "object")
            return res.status(400).json({ error: "Invalid config data" });
        for (const [key, value] of Object.entries(updates)) {
            if (UI_CONFIG_KEYS.includes(key)) {
                const stringValue = typeof value === "boolean" ? String(value) : value;
                setConfig(key, stringValue);
            } else {
                return res
                    .status(403)
                    .json({ error: `Config key '${key}' is not accessible to UI` });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error updating config:", error);
        res.status(500).json({ error: "Failed to update config" });
    }
});

export default router;
