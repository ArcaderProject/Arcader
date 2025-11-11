import fs from "fs";
import path from "path";
import {getRetroArchHomeDirName} from "./directoryUtils.js";

const RETROARCH_CONFIG_PATH = path.join(
    process.cwd(),
    "data/retroarch",
    `${getRetroArchHomeDirName()}/.config/retroarch/retroarch.cfg`
);

export const applyRetroArchConfigOverrides = (overrides) => {
    if (!overrides || Object.keys(overrides).length === 0) {
        return;
    }

    if (!fs.existsSync(RETROARCH_CONFIG_PATH)) {
        console.error("RetroArch config file not found:", RETROARCH_CONFIG_PATH);
        return;
    }

    try {
        const content = fs.readFileSync(RETROARCH_CONFIG_PATH, "utf8");
        const lines = content.split("\n");
        const modifiedLines = [];
        const appliedKeys = new Set();

        for (const line of lines) {
            const trimmed = line.trim();

            const match = trimmed.match(/^([a-zA-Z0-9_]+)\s*=/);
            if (match && overrides.hasOwnProperty(match[1])) {
                const key = match[1];
                modifiedLines.push(`${key} = "${overrides[key]}"`);
                appliedKeys.add(key);
            } else {
                modifiedLines.push(line);
            }
        }

        for (const [key, value] of Object.entries(overrides)) {
            if (!appliedKeys.has(key)) {
                modifiedLines.push(`${key} = "${value}"`);
            }
        }

        fs.writeFileSync(RETROARCH_CONFIG_PATH, modifiedLines.join("\n"), "utf8");

        console.log("Applied RetroArch config overrides:", Object.keys(overrides).join(", "));
    } catch (error) {
        console.error("Failed to apply RetroArch config overrides:", error);
    }
};