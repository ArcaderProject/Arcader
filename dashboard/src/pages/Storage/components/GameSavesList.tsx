import { useState, useEffect } from "react";
import { ContextMenu } from "@/components/retroui/ContextMenu";
import { Trash2, GamepadIcon, HardDrive } from "lucide-react";
import { getRequest, deleteRequest } from "@/common/utils/RequestUtil";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/retroui/ConfirmDialog";

interface Game {
    id: string;
    name: string;
    console: string;
    cover_art: number;
}

interface GameSave {
    gameId: string;
    fileCount: number;
    totalSize: number;
    game: Game;
}

interface GameSavesListProps {
    folderUuid: string;
    folderName: string;
    isLocked: boolean;
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

export const GameSavesList = ({ folderUuid, folderName, isLocked }: GameSavesListProps) => {
    const [gameSaves, setGameSaves] = useState<GameSave[]>([]);
    const [loading, setLoading] = useState(true);
    const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedGameSave, setSelectedGameSave] = useState<GameSave | null>(null);

    useEffect(() => {
        loadGameSaves();
    }, [folderUuid]);

    const loadGameSaves = async () => {
        try {
            setLoading(true);
            const data = await getRequest(`save-folders/${folderUuid}/games`);
            setGameSaves(data);

            const urls: Record<string, string> = {};
            for (const gameSave of data) {
                if (gameSave.game?.cover_art) {
                    try {
                        const token = localStorage.getItem("sessionToken");
                        const response = await fetch(`/api/games/${gameSave.gameId}/cover`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (response.ok) {
                            const blob = await response.blob();
                            urls[gameSave.gameId] = URL.createObjectURL(blob);
                        }
                    } catch (error) {
                        console.error(`Failed to load cover for game ${gameSave.gameId}:`, error);
                    }
                }
            }
            setCoverUrls(urls);
        } catch (error) {
            console.error("Failed to load game saves:", error);
            toast.error("Failed to load game saves");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGameSave = async () => {
        if (!selectedGameSave) return;

        try {
            const result = await deleteRequest(`save-folders/${folderUuid}/games/${selectedGameSave.gameId}`);
            const freedSpace = result.freedSpace || 0;
            const deletedCount = result.deletedCount || 0;

            toast.success(
                `Deleted ${deletedCount} save file(s) for "${selectedGameSave.game.name}" (freed ${formatBytes(freedSpace)})`
            );
            setDeleteConfirmOpen(false);
            await loadGameSaves();
        } catch (error: any) {
            console.error("Failed to delete game save:", error);
            if (error.error === "Cannot delete saves from a locked save folder") {
                toast.error("Cannot delete saves from a locked save folder");
            } else {
                toast.error("Failed to delete game save");
            }
        }
    };

    const confirmDelete = (gameSave: GameSave) => {
        setSelectedGameSave(gameSave);
        setDeleteConfirmOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-sm font-head text-muted-foreground">LOADING SAVES...</div>
            </div>
        );
    }

    if (gameSaves.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <HardDrive className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm font-head text-muted-foreground">NO SAVES IN THIS STORAGE</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-2 mt-4">
                {gameSaves.map((gameSave) => (
                    <ContextMenu key={gameSave.gameId}>
                        <ContextMenu.Trigger asChild>
                            <div className="group border-2 border-border bg-background hover:border-primary/50 transition-all p-3 cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0 w-16 h-24 border-2 border-border bg-muted overflow-hidden">
                                        {gameSave.game.cover_art && coverUrls[gameSave.gameId] ? (
                                            <img
                                                src={coverUrls[gameSave.gameId]}
                                                alt={gameSave.game.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <GamepadIcon className="w-8 h-8 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-head font-bold text-base truncate">
                                            {gameSave.game.name}
                                        </h4>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {gameSave.game.console}
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 text-xs font-mono">
                                            <span className="text-muted-foreground">
                                                {gameSave.fileCount} file{gameSave.fileCount !== 1 ? "s" : ""}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {formatBytes(gameSave.totalSize)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ContextMenu.Trigger>

                        <ContextMenu.Content>
                            <ContextMenu.Item
                                onClick={() => confirmDelete(gameSave)}
                                disabled={isLocked}
                                variant="destructive"
                            >
                                <Trash2 className="w-4 h-4" />
                                DELETE SAVES
                            </ContextMenu.Item>
                        </ContextMenu.Content>
                    </ContextMenu>
                ))}
            </div>

            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="DELETE GAME SAVES"
                description={`Are you sure you want to delete all save states for "${selectedGameSave?.game.name}" from "${folderName}"? This will delete ${selectedGameSave?.fileCount} file(s) (${formatBytes(selectedGameSave?.totalSize || 0)}) and cannot be undone.`}
                confirmLabel="DELETE"
                cancelLabel="CANCEL"
                onConfirm={handleDeleteGameSave}
                variant="destructive"
            />
        </>
    );
};
