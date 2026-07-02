import { useState, useEffect } from "react";
import {
    getRequest,
    postRequest,
    putRequest,
    deleteRequest,
} from "@/common/utils/RequestUtil";
import { toast } from "sonner";

export interface App {
    id: string;
    name: string;
    type: string;
    url: string | null;
    userAgent: string | null;
    exec: string | null;
    args: string[];
    icon: boolean;
    enabled: boolean;
    position: number | null;
}

export interface AppInput {
    name: string;
    type: string;
    url?: string | null;
    userAgent?: string | null;
    exec?: string | null;
    args?: string[];
}

export const useApps = () => {
    const [apps, setApps] = useState<App[]>([]);
    const [loading, setLoading] = useState(true);
    const [iconUrls, setIconUrls] = useState<Record<string, string>>({});

    const loadApps = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data: App[] = await getRequest("apps");
            setApps(data);

            const newIconUrls: Record<string, string> = {};
            for (const app of data) {
                if (app.icon) {
                    try {
                        const token = localStorage.getItem("sessionToken");
                        const response = await fetch(`/api/apps/${app.id}/icon`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (response.ok) {
                            const blob = await response.blob();
                            newIconUrls[app.id] = URL.createObjectURL(blob);
                        }
                    } catch (error) {
                        console.error(`Failed to load icon for ${app.name}:`, error);
                    }
                }
            }
            setIconUrls(newIconUrls);
        } catch (error) {
            console.error("Failed to load apps:", error);
            if (!silent) toast.error("Failed to load apps");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const createApp = async (input: AppInput) => {
        try {
            await postRequest("apps", input);
            toast.success("App added successfully");
            await loadApps();
        } catch (error: any) {
            console.error("Failed to add app:", error);
            toast.error(error.error || error.message || "Failed to add app");
            throw error;
        }
    };

    const updateApp = async (appId: string, input: Partial<AppInput> & { enabled?: boolean }) => {
        try {
            await putRequest(`apps/${appId}`, input);
            toast.success("App updated");
            await loadApps();
        } catch (error: any) {
            console.error("Failed to update app:", error);
            toast.error(error.error || error.message || "Failed to update app");
            throw error;
        }
    };

    const deleteApp = async (appId: string) => {
        try {
            await deleteRequest(`apps/${appId}`);
            toast.success("App deleted");
            await loadApps();
        } catch (error) {
            console.error("Failed to delete app:", error);
            toast.error("Failed to delete app");
        }
    };

    const launchApp = async (appId: string, appName: string) => {
        try {
            await postRequest(`apps/${appId}/launch`, {});
            toast.success(`Launched ${appName}`);
        } catch (error: any) {
            console.error("Failed to launch app:", error);
            toast.error(error.error || error.message || "Failed to launch app");
        }
    };

    const uploadIcon = async (appId: string, file: File) => {
        const formData = new FormData();
        formData.append("icon", file);
        try {
            const token = localStorage.getItem("sessionToken");
            const response = await fetch(`/api/apps/${appId}/icon`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!response.ok) throw new Error("Failed to upload icon");
            toast.success("Icon uploaded");
            await loadApps();
        } catch (error) {
            console.error("Failed to upload icon:", error);
            toast.error("Failed to upload icon");
        }
    };

    useEffect(() => {
        loadApps();
    }, []);

    useEffect(() => {
        return () => {
            Object.values(iconUrls).forEach((url) => {
                if (url.startsWith("blob:")) URL.revokeObjectURL(url);
            });
        };
    }, [iconUrls]);

    return {
        apps,
        loading,
        iconUrls,
        loadApps,
        createApp,
        updateApp,
        deleteApp,
        launchApp,
        uploadIcon,
    };
};
