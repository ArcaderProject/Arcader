import { useContext, useState, useEffect } from "react";
import { ConfigContext } from "@/common/contexts/ConfigProvider";
import {
    Tabs,
    TabsContent,
    TabsTrigger,
    TabsTriggerList,
    TabsPanels,
} from "@/components/retroui/Tab";
import { Input } from "@/components/retroui/Input";
import { Switch } from "@/components/retroui/Switch";
import { Button } from "@/components/retroui/Button";
import { Save } from "lucide-react";
import arcadeMachine from "@/common/assets/arcade-machine.png";

export const Settings = () => {
    const { config, loading, updateConfig } = useContext(ConfigContext);

    const [formData, setFormData] = useState({
        insertMessage: "",
        infoMessage: "",
        konamiCodeEnabled: false,
        coinSlotEnabled: true,
        steamGridDbApiKey: "",
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (config) {
            setFormData({
                insertMessage: config["coinScreen.insertMessage"] || "",
                infoMessage: config["coinScreen.infoMessage"] || "",
                konamiCodeEnabled:
                    config["coinScreen.konamiCodeEnabled"] || false,
                coinSlotEnabled: config["coinScreen.coinSlotEnabled"] ?? true,
                steamGridDbApiKey: config["steamGridDbApiKey"] || "",
            });
        }
    }, [config]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateConfig({
                "coinScreen.insertMessage": formData.insertMessage,
                "coinScreen.infoMessage": formData.infoMessage,
                "coinScreen.konamiCodeEnabled": formData.konamiCodeEnabled,
                "coinScreen.coinSlotEnabled": formData.coinSlotEnabled,
                steamGridDbApiKey: formData.steamGridDbApiKey || null,
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl font-head">LOADING SETTINGS...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                <div className="lg:col-span-4 flex items-center justify-center">
                    <div className="relative">
                        <img
                            src={arcadeMachine}
                            alt="Arcade Machine"
                            className="w-full h-auto max-w-sm mx-auto"
                            style={{
                                filter: "drop-shadow(0 0 20px rgba(236, 80, 50, 0.3))",
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                    </div>
                </div>

                <div className="lg:col-span-8">
                    <Tabs>
                        <TabsTriggerList className="mb-4">
                            <TabsTrigger>COIN SCREEN</TabsTrigger>
                            <TabsTrigger>INTEGRATIONS</TabsTrigger>
                        </TabsTriggerList>

                        <TabsPanels>
                            <TabsContent>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-head font-bold mb-2 uppercase tracking-wider">
                                            Insert Message
                                        </label>
                                        <Input
                                            value={formData.insertMessage}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    insertMessage:
                                                        e.target.value,
                                                })
                                            }
                                            placeholder="INSERT COIN"
                                            className="font-head text-lg"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            The main message displayed on the
                                            coin screen
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-head font-bold mb-2 uppercase tracking-wider">
                                            Info Message
                                        </label>
                                        <Input
                                            value={formData.infoMessage}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    infoMessage: e.target.value,
                                                })
                                            }
                                            placeholder="Insert Coin to enter Game Library..."
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Additional information shown below
                                            the main message
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between p-4 border-2 border-border rounded bg-muted/10">
                                        <div>
                                            <label className="block text-sm font-head font-bold uppercase tracking-wider">
                                                Coin Slot Enabled
                                            </label>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Enable physical coin slot
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formData.coinSlotEnabled}
                                            onCheckedChange={(checked) =>
                                                setFormData({
                                                    ...formData,
                                                    coinSlotEnabled: checked,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 border-2 border-border rounded bg-muted/10">
                                        <div>
                                            <label className="block text-sm font-head font-bold uppercase tracking-wider">
                                                Konami Code Enabled
                                            </label>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Allow Konami Code (↑↑↓↓←→←→BA)
                                                to bypass coin screen
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formData.konamiCodeEnabled}
                                            onCheckedChange={(checked) =>
                                                setFormData({
                                                    ...formData,
                                                    konamiCodeEnabled: checked,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-head font-bold mb-2 uppercase tracking-wider">
                                            SteamGridDB API Key
                                        </label>
                                        <Input
                                            type="password"
                                            value={formData.steamGridDbApiKey}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    steamGridDbApiKey:
                                                        e.target.value,
                                                })
                                            }
                                            placeholder="Enter your API key"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            API key for automatically fetching
                                            game covers from SteamGridDB
                                        </p>
                                        <a
                                            href="https://www.steamgriddb.com/profile/preferences/api"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline mt-2 inline-block"
                                        >
                                            Get your API key →
                                        </a>
                                    </div>
                                </div>
                            </TabsContent>
                        </TabsPanels>
                    </Tabs>

                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="gap-2 px-8"
                            size="lg"
                        >
                            <Save className="w-5 h-5" />
                            {isSaving ? "SAVING..." : "SAVE SETTINGS"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
