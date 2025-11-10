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
import { Save, Key, RefreshCw, Copy, Check } from "lucide-react";
import arcadeMachine from "@/common/assets/arcade-machine.png";

export const Settings = () => {
    const { config, loading, updateConfig, updatePassword } =
        useContext(ConfigContext);

    const [formData, setFormData] = useState({
        insertMessage: "",
        infoMessage: "",
        konamiCodeEnabled: false,
        coinSlotEnabled: true,
        steamGridDbApiKey: "",
        password: "",
    });

    const [isSaving, setIsSaving] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [copiedPassword, setCopiedPassword] = useState(false);

    useEffect(() => {
        if (config) {
            setFormData({
                insertMessage: config["coinScreen.insertMessage"] || "",
                infoMessage: config["coinScreen.infoMessage"] || "",
                konamiCodeEnabled:
                    config["coinScreen.konamiCodeEnabled"] || false,
                coinSlotEnabled: config["coinScreen.coinSlotEnabled"] ?? true,
                steamGridDbApiKey: config["steamGridDbApiKey"] || "",
                password: "",
            });
        }
    }, [config]);

    useEffect(() => {
        if (!formData.password) {
            setPasswordStrength(0);
            return;
        }

        let strength = 0;
        if (formData.password.length >= 6) strength += 30;
        if (formData.password.length >= 10) strength += 20;
        if (/[a-z]/.test(formData.password)) strength += 15;
        if (/[A-Z]/.test(formData.password)) strength += 15;
        if (/[0-9]/.test(formData.password)) strength += 20;

        setPasswordStrength(Math.min(strength, 100));
    }, [formData.password]);

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

            if (formData.password.trim()) {
                await updatePassword(formData.password);
                setFormData({ ...formData, password: "" });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePassword = () => {
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const length = 16;
        let password = "";

        for (let i = 0; i < length; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }

        setFormData({ ...formData, password });
    };

    const copyPasswordToClipboard = () => {
        if (formData.password) {
            navigator.clipboard.writeText(formData.password);
            setCopiedPassword(true);
            setTimeout(() => setCopiedPassword(false), 2000);
        }
    };

    const getPasswordStrengthColor = () => {
        if (passwordStrength < 40) return "bg-destructive";
        if (passwordStrength < 70) return "bg-accent";
        return "bg-primary";
    };

    const getPasswordStrengthLabel = () => {
        if (passwordStrength === 0) return "";
        if (passwordStrength < 40) return "WEAK";
        if (passwordStrength < 70) return "MODERATE";
        return "STRONG";
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
                            <TabsTrigger>PASSWORD</TabsTrigger>
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
                                        <div className="flex items-center gap-3 mb-4">
                                            <Key className="w-6 h-6 text-primary" />
                                            <div className="flex-1">
                                                <h3 className="text-lg font-head font-bold uppercase">
                                                    Admin Password
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Change your admin dashboard
                                                    password
                                                </p>
                                            </div>
                                            <Button
                                                onClick={handleGeneratePassword}
                                                variant="outline"
                                                className="gap-2"
                                                size="sm"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                                GENERATE
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-head font-bold mb-2 uppercase tracking-wider">
                                                    New Password
                                                </label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="text"
                                                        value={
                                                            formData.password
                                                        }
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                password:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        placeholder="Enter new password"
                                                        className="font-mono flex-1"
                                                    />
                                                    {formData.password && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={
                                                                copyPasswordToClipboard
                                                            }
                                                            className="flex-shrink-0"
                                                        >
                                                            {copiedPassword ? (
                                                                <Check className="w-4 h-4" />
                                                            ) : (
                                                                <Copy className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                                {formData.password && (
                                                    <div className="mt-2">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs font-head font-bold uppercase">
                                                                Strength:{" "}
                                                                {getPasswordStrengthLabel()}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {
                                                                    passwordStrength
                                                                }
                                                                %
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-muted border-2 border-border">
                                                            <div
                                                                className={`h-full transition-all ${getPasswordStrengthColor()}`}
                                                                style={{
                                                                    width: `${passwordStrength}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
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
