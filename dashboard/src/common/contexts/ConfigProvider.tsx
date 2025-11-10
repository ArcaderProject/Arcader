import { createContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getRequest, putRequest } from "@/common/utils/RequestUtil";
import { toast } from "sonner";

export interface Config {
    "coinScreen.insertMessage": string;
    "coinScreen.infoMessage": string;
    "coinScreen.konamiCodeEnabled": boolean;
    "coinScreen.coinSlotEnabled": boolean;
    steamGridDbApiKey: string | null;
}

interface ConfigContextType {
    config: Config | null;
    loading: boolean;
    updateConfig: (updates: Partial<Config>) => Promise<void>;
    refreshConfig: () => Promise<void>;
}

export const ConfigContext = createContext<ConfigContextType>({
    config: null,
    loading: true,
    updateConfig: async () => {},
    refreshConfig: async () => {},
});

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
    const [config, setConfig] = useState<Config | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const data = await getRequest("config");
            setConfig(data);
        } catch (error) {
            console.error("Failed to fetch config:", error);
            toast.error("Failed to load configuration");
        } finally {
            setLoading(false);
        }
    };

    const updateConfig = async (updates: Partial<Config>) => {
        try {
            await putRequest("config", updates);
            toast.success("Settings saved successfully!");
            await fetchConfig();
        } catch (error) {
            console.error("Failed to update config:", error);
            toast.error("Failed to save settings");
            throw error;
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return (
        <ConfigContext.Provider
            value={{
                config,
                loading,
                updateConfig,
                refreshConfig: fetchConfig,
            }}
        >
            {children}
        </ConfigContext.Provider>
    );
};
