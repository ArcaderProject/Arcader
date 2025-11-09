import { useState, useEffect } from "react";
import { getRequest, postRequest } from "@/common/utils/RequestUtil";
import { toast } from "sonner";
import type { Game } from "./useGames";

interface CurrentlyPlaying {
    playing: boolean;
    game: Game | null;
}

export const useCurrentlyPlaying = () => {
    const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlaying>({
        playing: false,
        game: null,
    });

    const loadCurrentlyPlaying = async () => {
        try {
            const data = await getRequest("games/playing/current");
            setCurrentlyPlaying(data);
        } catch (error) {
            console.error("Failed to load currently playing game:", error);
        }
    };

    const stopGame = async () => {
        try {
            await postRequest("games/playing/stop", {});
            toast.success("Game stopped");
            loadCurrentlyPlaying();
        } catch (error) {
            console.error("Failed to stop game:", error);
            toast.error("Failed to stop game");
        }
    };

    useEffect(() => {
        loadCurrentlyPlaying();
        const interval = setInterval(loadCurrentlyPlaying, 5000);
        return () => clearInterval(interval);
    }, []);

    return { currentlyPlaying, loadCurrentlyPlaying, stopGame };
};
