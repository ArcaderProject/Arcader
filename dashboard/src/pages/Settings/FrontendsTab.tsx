import { useEffect, useState } from "react";
import {
    getRequest,
    postRequest,
    deleteRequest,
} from "@/common/utils/RequestUtil";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import {
    Plus,
    RefreshCw,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    MonitorPlay,
} from "lucide-react";

interface Frontend {
    id: string;
    name: string;
    description?: string;
    repoUrl?: string;
    compat?: string;
    installedVersion?: string | null;
    active: boolean;
    compatible: boolean;
    arch: string;
}

interface UpdateInfo {
    latestVersion: string;
    updateAvailable: boolean;
    compatible: boolean;
}

const errorMessage = (e: unknown): string => {
    if (e && typeof e === "object" && "error" in e)
        return String((e as { error: unknown }).error);
    if (e instanceof Error) return e.message;
    return "Something went wrong";
};

export const FrontendsTab = () => {
    const [frontends, setFrontends] = useState<Frontend[]>([]);
    const [loading, setLoading] = useState(true);
    const [url, setUrl] = useState("");
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [updates, setUpdates] = useState<Record<string, UpdateInfo>>({});

    const load = async () => {
        try {
            const data = await getRequest("frontends");
            setFrontends(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const add = async () => {
        if (!url.trim()) return;
        setAdding(true);
        setError(null);
        try {
            await postRequest("frontends", { url: url.trim() });
            setUrl("");
            await load();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setAdding(false);
        }
    };

    const act = async (id: string, action: () => Promise<unknown>) => {
        setBusy(id);
        setError(null);
        try {
            await action();
            await load();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(null);
        }
    };

    const checkUpdate = async (id: string) => {
        setBusy(id);
        setError(null);
        try {
            const info = (await postRequest(
                `frontends/${id}/check-update`,
                undefined,
            )) as UpdateInfo;
            setUpdates((u) => ({ ...u, [id]: info }));
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(null);
        }
    };

    if (loading) {
        return <div className="font-head uppercase">Loading frontends...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-head font-bold uppercase flex items-center gap-2">
                    <MonitorPlay className="w-5 h-5 text-primary" />
                    Frontends
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Swap out the on-screen interface. arcaderd downloads the
                    frontend from its GitHub repository and switches to it live.
                </p>
            </div>

            <div>
                <label className="block text-sm font-head font-bold mb-2 uppercase tracking-wider">
                    Add a frontend by GitHub URL
                </label>
                <div className="flex gap-2">
                    <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://github.com/owner/repo"
                        className="flex-1 font-mono"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") add();
                        }}
                    />
                    <Button
                        onClick={add}
                        disabled={adding || !url.trim()}
                        className="gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        {adding ? "RESOLVING..." : "ADD"}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 border-2 border-destructive text-destructive rounded text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {frontends.map((f) => {
                    const upd = updates[f.id];
                    return (
                        <div
                            key={f.id}
                            className="p-4 border-2 border-border rounded bg-muted/10"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-head font-bold uppercase">
                                            {f.name}
                                        </span>
                                        {f.active && (
                                            <span className="px-2 py-0.5 text-[10px] font-head font-bold uppercase border-2 border-primary text-primary rounded">
                                                Active
                                            </span>
                                        )}
                                        {f.compatible ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-head font-bold uppercase border-2 border-border rounded">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Compatible
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-head font-bold uppercase border-2 border-destructive text-destructive rounded">
                                                <AlertTriangle className="w-3 h-3" />
                                                Incompatible
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate mt-1">
                                        {f.repoUrl}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {f.installedVersion
                                            ? `Installed ${f.installedVersion}`
                                            : "Not installed"}
                                        {upd?.updateAvailable &&
                                            ` → ${upd.latestVersion} available`}
                                        {" · "}
                                        {f.arch}
                                    </p>
                                </div>

                                <div className="flex flex-shrink-0 gap-2 flex-wrap justify-end">
                                    {!f.active && f.compatible && (
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                act(f.id, () =>
                                                    postRequest(
                                                        `frontends/${f.id}/activate`,
                                                        undefined,
                                                    ),
                                                )
                                            }
                                            disabled={busy === f.id}
                                        >
                                            Activate
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => checkUpdate(f.id)}
                                        disabled={busy === f.id}
                                        className="gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Check
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            act(f.id, () =>
                                                postRequest(
                                                    `frontends/${f.id}/update`,
                                                    undefined,
                                                ),
                                            )
                                        }
                                        disabled={busy === f.id || !f.compatible}
                                    >
                                        Update
                                    </Button>
                                    {!f.active && f.id !== "main" && (
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() =>
                                                act(f.id, () =>
                                                    deleteRequest(
                                                        `frontends/${f.id}`,
                                                    ),
                                                )
                                            }
                                            disabled={busy === f.id}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {frontends.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No frontends registered yet.
                    </p>
                )}
            </div>
        </div>
    );
};
