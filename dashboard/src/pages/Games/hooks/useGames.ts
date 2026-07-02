import { useState, useEffect, useRef } from "react";
import {
    getRequest,
    deleteRequest,
    putRequest,
    postRequest,
} from "@/common/utils/RequestUtil";
import { toast } from "sonner";

export interface Game {
    id: string;
    name: string;
    filename: string;
    extension: string;
    console: string;
    core: string;
    cover_art: number;
    created_at: string;
}

export interface ArchiveEntry {
    name: string;
    extension: string;
    supported: boolean;
    console: string;
}

export interface PendingArchive {
    archive: true;
    token: string;
    filename: string;
    entries: ArchiveEntry[];
    supportedCount: number;
}

export const useGames = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
    const previousGamesRef = useRef<Game[]>([]);

    const loadGames = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await getRequest("games");
            setGames(data);

            const newCoverUrls: Record<string, string> = {};
            for (const game of data) {
                if (game.cover_art) {
                    try {
                        const token = localStorage.getItem("sessionToken");
                        const response = await fetch(
                            `/api/games/${game.id}/cover`,
                            {
                                headers: { Authorization: `Bearer ${token}` },
                            },
                        );
                        if (response.ok) {
                            const blob = await response.blob();
                            newCoverUrls[game.id] = URL.createObjectURL(blob);
                        }
                    } catch (error) {
                        console.error(
                            `Failed to load cover for ${game.name}:`,
                            error,
                        );
                    }
                }
            }
            setCoverUrls(newCoverUrls);
        } catch (error) {
            console.error("Failed to load games:", error);
            if (!silent) toast.error("Failed to load games");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const uploadRom = async (file: File): Promise<PendingArchive | null> => {
        const formData = new FormData();
        formData.append("rom", file);

        try {
            const token = localStorage.getItem("sessionToken");
            const response = await fetch("/api/games", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to upload ROM");
            }

            const data = await response.json();

            if (data && data.archive) {
                return data as PendingArchive;
            }

            toast.success("ROM uploaded successfully");
            loadGames();
            return null;
        } catch (error: any) {
            console.error("Failed to upload ROM:", error);
            toast.error(error.message || "Failed to upload ROM");
            return null;
        }
    };

    const completeArchiveImport = async (
        token: string,
        mode: "extract" | "install",
    ) => {
        try {
            const result = await postRequest(`games/import/${token}`, { mode });

            if (mode === "install") {
                toast.success("ROM uploaded successfully");
            } else {
                const installed = result?.installedCount ?? 0;
                const skipped = result?.skippedCount ?? 0;
                toast.success(
                    `Imported ${installed} game${installed === 1 ? "" : "s"}` +
                        (skipped ? ` (${skipped} skipped)` : ""),
                );
            }

            loadGames();
        } catch (error: any) {
            console.error("Failed to import archive:", error);
            toast.error(error.error || error.message || "Failed to import archive");
        }
    };

    const cancelArchiveImport = async (token: string) => {
        try {
            await deleteRequest(`games/import/${token}`);
        } catch (error) {
            console.error("Failed to discard archive import:", error);
        }
    };

    const uploadCover = async (gameId: string, file: File) => {
        const formData = new FormData();
        formData.append("cover", file);

        try {
            const token = localStorage.getItem("sessionToken");
            const response = await fetch(`/api/games/${gameId}/cover`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) throw new Error("Failed to upload cover art");

            toast.success("Cover art uploaded successfully");
            loadGames();
        } catch (error) {
            console.error("Failed to upload cover art:", error);
            toast.error("Failed to upload cover art");
        }
    };

    const selectCoverFromUrl = async (gameId: string, coverUrl: string) => {
        try {
            await postRequest(`games/${gameId}/cover-from-url`, { coverUrl });
            toast.success("Cover art updated successfully");
            loadGames();
        } catch (error) {
            console.error("Failed to update cover art:", error);
            toast.error("Failed to update cover art");
        }
    };

    const renameGame = async (gameId: string, newName: string) => {
        try {
            await putRequest(`games/${gameId}`, { name: newName });
            toast.success("Game renamed successfully");
            loadGames();
        } catch (error) {
            console.error("Failed to rename game:", error);
            toast.error("Failed to rename game");
        }
    };

    const deleteGame = async (gameId: string) => {
        try {
            await deleteRequest(`games/${gameId}`);
            toast.success("Game deleted successfully");
            loadGames();
        } catch (error) {
            console.error("Failed to delete game:", error);
            toast.error("Failed to delete game");
        }
    };

    const startGame = async (gameId: string, gameName: string) => {
        try {
            await postRequest(`games/${gameId}/start`, {});
            toast.success(`Started ${gameName}`);
        } catch (error: any) {
            console.error("Failed to start game:", error);
            toast.error(error.message || "Failed to start game");
        }
    };

    useEffect(() => {
        loadGames();
    }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const data = await getRequest("games");
                const oldGamesMap = new Map(
                    previousGamesRef.current.map((g) => [g.id, g]),
                );

                let hasNewCovers = false;
                for (const game of data) {
                    const oldGame = oldGamesMap.get(game.id);
                    if (oldGame && !oldGame.cover_art && game.cover_art) {
                        hasNewCovers = true;
                        break;
                    }
                }

                if (hasNewCovers) await loadGames(true);

                previousGamesRef.current = data;
            } catch (error) {}
        }, 2000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        return () => {
            Object.values(coverUrls).forEach((url) => {
                if (url.startsWith("blob:")) URL.revokeObjectURL(url);
            });
        };
    }, [coverUrls]);

    return {
        games,
        loading,
        coverUrls,
        loadGames,
        uploadRom,
        completeArchiveImport,
        cancelArchiveImport,
        uploadCover,
        selectCoverFromUrl,
        renameGame,
        deleteGame,
        startGame,
    };
};
