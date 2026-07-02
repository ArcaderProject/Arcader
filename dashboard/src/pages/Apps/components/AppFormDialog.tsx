import { useEffect, useState } from "react";
import { Dialog } from "@/components/retroui/Dialog";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { Switch } from "@/components/retroui/Switch";
import type { App, AppInput } from "../hooks/useApps";

interface AppFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    app: App | null;
    onSubmit: (input: AppInput & { enabled?: boolean }) => Promise<void>;
}

export const AppFormDialog = ({
    open,
    onOpenChange,
    app,
    onSubmit,
}: AppFormDialogProps) => {
    const [name, setName] = useState("");
    const [type, setType] = useState("web");
    const [url, setUrl] = useState("");
    const [userAgent, setUserAgent] = useState("");
    const [exec, setExec] = useState("");
    const [args, setArgs] = useState("");
    const [enabled, setEnabled] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(app?.name ?? "");
        setType(app?.type ?? "web");
        setUrl(app?.url ?? "");
        setUserAgent(app?.userAgent ?? "");
        setExec(app?.exec ?? "");
        setArgs((app?.args ?? []).join(" "));
        setEnabled(app?.enabled ?? true);
    }, [open, app]);

    const valid =
        name.trim().length > 0 &&
        (type === "web" ? url.trim().length > 0 : exec.trim().length > 0);

    const handleSave = async () => {
        if (!valid) return;
        setSaving(true);
        try {
            const input: AppInput & { enabled?: boolean } = {
                name: name.trim(),
                type,
                enabled,
            };
            if (type === "web") {
                input.url = url.trim();
                input.userAgent = userAgent.trim() || null;
                input.exec = null;
                input.args = [];
            } else {
                input.exec = exec.trim();
                input.args = args.trim() ? args.trim().split(/\s+/) : [];
                input.url = null;
                input.userAgent = null;
            }
            await onSubmit(input);
            onOpenChange(false);
        } catch {
            setSaving(false);
            return;
        }
        setSaving(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Dialog.Content size="md">
                <Dialog.Header>{app ? "EDIT APP" : "ADD APP"}</Dialog.Header>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-head font-semibold">NAME</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="YouTube"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-head font-semibold">TYPE</label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={type === "web" ? "default" : "outline"}
                                className="flex-1"
                                onClick={() => setType("web")}
                            >
                                WEB
                            </Button>
                            <Button
                                type="button"
                                variant={type === "native" ? "default" : "outline"}
                                className="flex-1"
                                onClick={() => setType("native")}
                            >
                                NATIVE
                            </Button>
                        </div>
                    </div>

                    {type === "web" ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-head font-semibold">URL</label>
                                <Input
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://youtube.com/tv"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-head font-semibold">
                                    USER AGENT (optional)
                                </label>
                                <Input
                                    value={userAgent}
                                    onChange={(e) => setUserAgent(e.target.value)}
                                    placeholder="Custom user agent"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-head font-semibold">
                                    EXECUTABLE
                                </label>
                                <Input
                                    value={exec}
                                    onChange={(e) => setExec(e.target.value)}
                                    placeholder="/usr/bin/nautilus"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-head font-semibold">
                                    ARGUMENTS (space-separated)
                                </label>
                                <Input
                                    value={args}
                                    onChange={(e) => setArgs(e.target.value)}
                                    placeholder="--new-window"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <label className="text-sm font-head font-semibold">ENABLED</label>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>
                </div>
                <Dialog.Footer>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        CANCEL
                    </Button>
                    <Button onClick={handleSave} disabled={!valid || saving}>
                        {saving ? "SAVING..." : "SAVE"}
                    </Button>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog>
    );
};
