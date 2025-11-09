import { useState, useEffect } from "react";
import {
    getRequest,
    postRequest,
    putRequest,
    deleteRequest,
} from "@/common/utils/RequestUtil";

export interface GameList {
    id: string;
    name: string;
    type: "include" | "exclude";
    is_default: number;
    created_at: string;
    item_count?: number;
}

export const useLists = () => {
    const [lists, setLists] = useState<GameList[]>([]);
    const [selectedList, setSelectedList] = useState<GameList | null>(null);
    const [loading, setLoading] = useState(true);

    const loadLists = async () => {
        try {
            const data = await getRequest("lists");
            setLists(data);
        } catch (error) {
            console.error("Failed to load lists:", error);
        }
    };

    const loadSelectedList = async () => {
        try {
            const data = await getRequest("lists/selected");
            setSelectedList(data);
        } catch (error) {
            console.error("Failed to load selected list:", error);
        }
    };

    const createList = async (name: string, type: "include" | "exclude") => {
        try {
            await postRequest("lists", { name, type });
            await loadLists();
        } catch (error: any) {
            console.error("Failed to create list:", error);
            throw error;
        }
    };

    const updateList = async (id: string, name: string) => {
        try {
            await putRequest(`lists/${id}`, { name });
            await loadLists();
            if (selectedList?.id === id) {
                await loadSelectedList();
            }
        } catch (error: any) {
            console.error("Failed to update list:", error);
            throw error;
        }
    };

    const deleteList = async (id: string) => {
        try {
            await deleteRequest(`lists/${id}`);
            await loadLists();
            await loadSelectedList();
        } catch (error: any) {
            console.error("Failed to delete list:", error);
            throw error;
        }
    };

    const selectList = async (id: string) => {
        try {
            await postRequest("lists/selected", { listId: id });
            await loadSelectedList();
        } catch (error) {
            console.error("Failed to select list:", error);
            throw error;
        }
    };

    const getListGames = async (id: string): Promise<string[]> => {
        try {
            const data = await getRequest(`lists/${id}/games`);
            return data.gameIds;
        } catch (error) {
            console.error("Failed to load list games:", error);
            return [];
        }
    };

    const updateListGames = async (id: string, gameIds: string[]) => {
        try {
            await putRequest(`lists/${id}/games`, { gameIds });
            await loadLists();
        } catch (error) {
            console.error("Failed to update list games:", error);
            throw error;
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([loadLists(), loadSelectedList()]);
            setLoading(false);
        };
        init();
    }, []);

    return {
        lists,
        selectedList,
        loading,
        loadLists,
        loadSelectedList,
        createList,
        updateList,
        deleteList,
        selectList,
        getListGames,
        updateListGames,
    };
};
