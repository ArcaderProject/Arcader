import https from "https";
import fs from "fs";
import path from "path";
import { getConfig } from "./configUtils.js";

const downloadFile = (url, filePath) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        https
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                    return;
                }

                response.pipe(file);

                file.on("finish", () => {
                    file.close(resolve);
                });
            })
            .on("error", (err) => {
                console.error(`Failed to download '${url}': ${err.message}`);
                fs.unlink(filePath, () => reject(err));
            });
    });
};

const getApiKey = () => {
    const apiKey = getConfig("steamGridDbApiKey");
    if (!apiKey) {
        throw new Error("SteamGridDB API key not configured");
    }
    return apiKey;
};

export const lookupGameId = async (title) => {
    const apiKey = getApiKey();
    const encodedTitle = encodeURIComponent(title);

    const response = await fetch(
        `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodedTitle}`,
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        }
    );

    const json = await response.json();

    if (!json.data || json.data.length === 0) {
        return null;
    }

    return json.data[0].id;
};

export const getGameCovers = async (gameId, limit = 10) => {
    const apiKey = getApiKey();

    const response = await fetch(
        `https://www.steamgriddb.com/api/v2/grids/game/${gameId}?dimensions=600x900&limit=${limit}`,
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        }
    );

    const json = await response.json();

    if (!json.data || json.data.length === 0) {
        return [];
    }

    return json.data;
};

export const downloadCoverByUrl = async (coverUrl, gameId) => {
    const coverPath = path.join(process.cwd(), "data", "covers", `${gameId}.jpg`);

    try {
        await downloadFile(coverUrl, coverPath);
        console.log(`Downloaded cover to ${coverPath}`);
        return true;
    } catch (error) {
        console.error(`Error downloading cover: ${error.message}`);
        return false;
    }
};

export const downloadGameCover = async (gameName, gameId) => {
    try {
        const steamGameId = await lookupGameId(gameName);

        if (!steamGameId) {
            console.log(`No SteamGridDB match found for: ${gameName}`);
            return false;
        }

        const covers = await getGameCovers(steamGameId, 1);

        if (covers.length === 0) {
            console.log(`No covers found for: ${gameName}`);
            return false;
        }

        const coverUrl = covers[0].url;
        return await downloadCoverByUrl(coverUrl, gameId);
    } catch (error) {
        console.error(`Error in downloadGameCover for ${gameName}:`, error.message);
        return false;
    }
};
