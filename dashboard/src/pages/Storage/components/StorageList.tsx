import { useState } from "react";
import { ContextMenu } from "@/components/retroui/ContextMenu";
import {
    Lock,
    Unlock,
    Trash2,
    Edit2,
    CheckCircle2,
    Star,
    AlertTriangle,
    Save,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GameSavesList } from "./GameSavesList";
import { Button } from "@/components/retroui/Button";

export interface SaveFolder {
    uuid: string;
    name: string;
    isLocked: boolean;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
}

interface StorageListProps {
    folders: SaveFolder[];
    onActivate: (folder: SaveFolder) => void;
    onRename: (folder: SaveFolder) => void;
    onToggleLock: (folder: SaveFolder) => void;
    onClear: (folder: SaveFolder) => void;
    onDelete: (folder: SaveFolder) => void;
}

export const StorageList = ({
    folders,
    onActivate,
    onRename,
    onToggleLock,
    onClear,
    onDelete,
}: StorageListProps) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleExpanded = (uuid: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(uuid)) {
                next.delete(uuid);
            } else {
                next.add(uuid);
            }
            return next;
        });
    };

    return (
        <div className="space-y-3">
            {folders.map((folder) => {
                const isExpanded = expandedFolders.has(folder.uuid);
                
                return (
                    <div key={folder.uuid} className="border-4 border-border bg-secondary">
                        <ContextMenu>
                            <ContextMenu.Trigger asChild>
                                <div
                                    onClick={() => toggleExpanded(folder.uuid)}
                                    className={cn(
                                        "group relative p-4 transition-all duration-200 cursor-pointer",
                                        folder.isActive
                                            ? "bg-primary/5"
                                            : "bg-secondary hover:bg-primary/5"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div
                                                className={cn(
                                                    "flex-shrink-0 w-12 h-12 border-2 flex items-center justify-center",
                                                    folder.isActive
                                                        ? "border-primary bg-primary/10"
                                                        : "border-border bg-background"
                                                )}
                                            >
                                                <Save
                                                    className={cn(
                                                        "w-6 h-6",
                                                        folder.isActive
                                                            ? "text-primary"
                                                            : "text-muted-foreground"
                                                    )}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-head font-bold uppercase truncate">
                                                        {folder.name}
                                                    </h3>
                                                    {folder.isDefault && (
                                                        <Star className="w-4 h-4 text-accent flex-shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                    <span className="font-mono">
                                                        {folder.uuid}
                                                    </span>
                                                    {folder.isActive && (
                                                        <span className="flex items-center gap-1 text-primary font-head font-bold">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                    {folder.isLocked && (
                                                        <span className="flex items-center gap-1 text-destructive font-head font-bold">
                                                            <Lock className="w-3 h-3" />
                                                            LOCKED
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {!folder.isActive && (
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onActivate(folder);
                                                        }}
                                                        size="sm"
                                                        className="gap-2"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        ACTIVATE
                                                    </Button>
                                                )}
                                                
                                                <div className="flex-shrink-0">
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-6 h-6 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRight className="w-6 h-6 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ContextMenu.Trigger>

                            <ContextMenu.Content>
                                <ContextMenu.Item
                                    onClick={() => onRename(folder)}
                                    disabled={folder.isDefault}
                                >
                                    <Edit2 className="w-4 h-4" />
                                    RENAME
                                </ContextMenu.Item>

                                <ContextMenu.Item onClick={() => onToggleLock(folder)}>
                                    {folder.isLocked ? (
                                        <>
                                            <Unlock className="w-4 h-4" />
                                            UNLOCK
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-4 h-4" />
                                            LOCK
                                        </>
                                    )}
                                </ContextMenu.Item>

                                <ContextMenu.Separator />

                                <ContextMenu.Item
                                    onClick={() => onClear(folder)}
                                    disabled={folder.isLocked}
                                    variant="destructive"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    CLEAR STATES
                                </ContextMenu.Item>

                                <ContextMenu.Item
                                    onClick={() => onDelete(folder)}
                                    disabled={folder.isDefault}
                                    variant="destructive"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    DELETE
                                </ContextMenu.Item>
                            </ContextMenu.Content>
                        </ContextMenu>

                        {isExpanded && (
                            <div className="border-t-4 border-border p-4 bg-background">
                                <GameSavesList
                                    folderUuid={folder.uuid}
                                    folderName={folder.name}
                                    isLocked={folder.isLocked}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
