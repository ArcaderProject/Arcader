import { useState, useEffect } from "react";
import {
    getRequest,
    postRequest,
    putRequest,
    deleteRequest,
} from "@/common/utils/RequestUtil";

export interface ControllerBinding {
    btn: string;
    axis: string;
}

export type ControllerBindings = Record<
    string,
    Record<string, ControllerBinding>
>;

export interface ControllerProfile {
    id: string;
    name: string;
    is_default: number;
    bindings?: ControllerBindings;
    created_at: string;
    item_count?: number;
}

export const useControllerProfiles = () => {
    const [profiles, setProfiles] = useState<ControllerProfile[]>([]);
    const [loading, setLoading] = useState(true);

    const loadProfiles = async () => {
        try {
            const data = await getRequest("controller-profiles");
            setProfiles(data);
        } catch (error) {
            console.error("Failed to load controller profiles:", error);
        }
    };

    const createProfile = async (name: string) => {
        try {
            await postRequest("controller-profiles", { name });
            await loadProfiles();
        } catch (error: any) {
            console.error("Failed to create profile:", error);
            throw error;
        }
    };

    const updateProfile = async (id: string, name: string) => {
        try {
            await putRequest(`controller-profiles/${id}`, { name });
            await loadProfiles();
        } catch (error: any) {
            console.error("Failed to update profile:", error);
            throw error;
        }
    };

    const deleteProfile = async (id: string) => {
        try {
            await deleteRequest(`controller-profiles/${id}`);
            await loadProfiles();
        } catch (error: any) {
            console.error("Failed to delete profile:", error);
            throw error;
        }
    };

    const getProfileGames = async (id: string): Promise<string[]> => {
        try {
            const data = await getRequest(`controller-profiles/${id}/games`);
            return data.gameIds;
        } catch (error) {
            console.error("Failed to load profile games:", error);
            return [];
        }
    };

    const updateProfileGames = async (id: string, gameIds: string[]) => {
        try {
            await putRequest(`controller-profiles/${id}/games`, { gameIds });
            await loadProfiles();
        } catch (error) {
            console.error("Failed to update profile games:", error);
            throw error;
        }
    };

    const configureProfile = async (id: string) => {
        try {
            await postRequest(`controller-profiles/${id}/configure`, {});
        } catch (error: any) {
            console.error("Failed to start configuration:", error);
            throw error;
        }
    };

    const cancelConfigure = async (id: string) => {
        try {
            await postRequest(`controller-profiles/${id}/cancel`, {});
        } catch (error) {
            console.error("Failed to cancel configuration:", error);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await loadProfiles();
            setLoading(false);
        };
        init();
    }, []);

    return {
        profiles,
        loading,
        loadProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
        getProfileGames,
        updateProfileGames,
        configureProfile,
        cancelConfigure,
    };
};
