import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/retroui/Button";
import { Switch } from "@/components/retroui/Switch";
import { ConfirmDialog } from "@/components/retroui/ConfirmDialog";
import { Plus, Search, Play, Pencil, Image as ImageIcon, Trash2, Globe, TerminalSquare } from "lucide-react";
import { useApps, type App } from "./hooks/useApps";
import { AppFormDialog } from "./components/AppFormDialog";

export const Apps = ({ embedded = false }: { embedded?: boolean } = {}) => {
    const {
        apps,
        loading,
        iconUrls,
        createApp,
        updateApp,
        deleteApp,
        launchApp,
        uploadIcon,
    } = useApps();

    const [searchQuery, setSearchQuery] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editApp, setEditApp] = useState<App | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState<App | null>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const iconTargetRef = useRef<App | null>(null);

    const filteredApps = useMemo(() => {
        if (!searchQuery.trim()) return apps;
        const q = searchQuery.toLowerCase();
        return apps.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                a.type.toLowerCase().includes(q),
        );
    }, [apps, searchQuery]);

    const openAdd = () => {
        setEditApp(null);
        setFormOpen(true);
    };
    const openEdit = (app: App) => {
        setEditApp(app);
        setFormOpen(true);
    };
    const confirmDelete = (app: App) => {
        setSelectedApp(app);
        setDeleteConfirmOpen(true);
    };
    const pickIcon = (app: App) => {
        iconTargetRef.current = app;
        iconInputRef.current?.click();
    };
    const onIconPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const app = iconTargetRef.current;
        if (file && app) await uploadIcon(app.id, file);
        e.target.value = "";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full py-16">
                <div className="text-xl font-head">LOADING APPS...</div>
            </div>
        );
    }

    return (
        <div className={embedded ? "" : "p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="SEARCH APPS..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border-4 border-foreground bg-background font-head text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/50 transition-all"
                    />
                </div>
                <Button onClick={openAdd} className="gap-2 shrink-0">
                    <Plus className="w-5 h-5" />
                    ADD APP
                </Button>
            </div>

            {apps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
                    <Globe className="w-16 h-16 text-muted-foreground" />
                    <h3 className="text-2xl font-head font-bold">NO APPS YET</h3>
                    <p className="text-muted-foreground">
                        Add a web app (browser kiosk) or a native program.
                    </p>
                    <Button onClick={openAdd} className="gap-2">
                        <Plus className="w-5 h-5" />
                        ADD APP
                    </Button>
                </div>
            ) : filteredApps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <Search className="w-16 h-16 text-muted-foreground" />
                    <h3 className="text-2xl font-head font-bold">NO APPS FOUND</h3>
                    <p className="text-muted-foreground">
                        No apps match your search "{searchQuery}"
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredApps.map((app) => (
                        <AppCard
                            key={app.id}
                            app={app}
                            iconUrl={iconUrls[app.id]}
                            onLaunch={() => launchApp(app.id, app.name)}
                            onEdit={() => openEdit(app)}
                            onIcon={() => pickIcon(app)}
                            onDelete={() => confirmDelete(app)}
                            onToggle={(enabled) => updateApp(app.id, { enabled })}
                        />
                    ))}
                </div>
            )}

            <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onIconPicked}
            />

            <AppFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                app={editApp}
                onSubmit={async (input) => {
                    if (editApp) await updateApp(editApp.id, input);
                    else await createApp(input);
                }}
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="DELETE APP"
                description={`Are you sure you want to delete "${selectedApp?.name}"? This action cannot be undone.`}
                confirmLabel="DELETE"
                cancelLabel="CANCEL"
                onConfirm={() => selectedApp && deleteApp(selectedApp.id)}
                variant="destructive"
            />
        </div>
    );
};

interface AppCardProps {
    app: App;
    iconUrl?: string;
    onLaunch: () => void;
    onEdit: () => void;
    onIcon: () => void;
    onDelete: () => void;
    onToggle: (enabled: boolean) => void;
}

const AppCard = ({
    app,
    iconUrl,
    onLaunch,
    onEdit,
    onIcon,
    onDelete,
    onToggle,
}: AppCardProps) => {
    const initials = app.name.trim().slice(0, 2).toUpperCase() || "?";
    return (
        <div className="border-2 border-border bg-secondary p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 flex-shrink-0 border-2 border-border bg-background flex items-center justify-center overflow-hidden">
                    {app.icon && iconUrl ? (
                        <img src={iconUrl} alt={app.name} className="w-full h-full object-contain" />
                    ) : (
                        <span className="font-head font-bold text-lg">{initials}</span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-head font-bold truncate">{app.name}</span>
                        {app.type === "web" ? (
                            <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                            <TerminalSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                        {app.type === "web" ? app.url : [app.exec, ...app.args].join(" ")}
                    </p>
                </div>
                <Switch checked={app.enabled} onCheckedChange={onToggle} />
            </div>
            <div className="flex gap-2">
                <Button size="sm" className="gap-1 flex-1" onClick={onLaunch}>
                    <Play className="w-4 h-4" />
                    LAUNCH
                </Button>
                <Button size="icon" variant="outline" onClick={onEdit} aria-label="Edit">
                    <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={onIcon} aria-label="Upload icon">
                    <ImageIcon className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={onDelete} aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
