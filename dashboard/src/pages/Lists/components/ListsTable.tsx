import { useState } from "react";
import { ContextMenu } from "@/components/retroui/ContextMenu";
import { Button } from "@/components/retroui/Button";
import {
    Pencil,
    Trash2,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Star,
    List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ListManageGames } from "./ListManageGames";
import type { GameList } from "../hooks/useLists";

interface ListsTableProps {
    lists: GameList[];
    selectedList: GameList | null;
    onSelect: (list: GameList) => void;
    onEdit: (list: GameList) => void;
    onDelete: (list: GameList) => void;
}

export const ListsTable = ({
    lists,
    selectedList,
    onSelect,
    onEdit,
    onDelete,
}: ListsTableProps) => {
    const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());

    const toggleExpanded = (listId: string) => {
        setExpandedLists((prev) => {
            const next = new Set(prev);
            if (next.has(listId)) {
                next.delete(listId);
            } else {
                next.add(listId);
            }
            return next;
        });
    };

    return (
        <div className="space-y-3">
            {lists.map((list) => {
                const isExpanded = expandedLists.has(list.id);
                const isSelected = selectedList?.id === list.id;
                const isDefault = list.is_default === 1;

                return (
                    <div key={list.id} className="border-4 border-border bg-secondary">
                        <ContextMenu>
                            <ContextMenu.Trigger asChild>
                                <div
                                    onClick={() => !isDefault && toggleExpanded(list.id)}
                                    className={cn(
                                        "group relative p-4 transition-all duration-200",
                                        !isDefault && "cursor-pointer",
                                        isSelected
                                            ? "bg-primary/5"
                                            : "bg-secondary",
                                        !isDefault && "hover:bg-primary/5"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div
                                                className={cn(
                                                    "flex-shrink-0 w-12 h-12 border-2 flex items-center justify-center",
                                                    isSelected
                                                        ? "border-primary bg-primary/10"
                                                        : "border-border bg-background"
                                                )}
                                            >
                                                <List
                                                    className={cn(
                                                        "w-6 h-6",
                                                        isSelected
                                                            ? "text-primary"
                                                            : "text-muted-foreground"
                                                    )}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-head font-bold uppercase truncate">
                                                        {list.name}
                                                    </h3>
                                                    {isDefault && (
                                                        <Star className="w-4 h-4 text-accent flex-shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                    <span className="uppercase">
                                                        {list.type}
                                                    </span>
                                                    <span>
                                                        {list.item_count || 0} games
                                                    </span>
                                                    {isSelected && (
                                                        <span className="flex items-center gap-1 text-primary font-head font-bold">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {!isSelected && (
                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelect(list);
                                                        }}
                                                        size="sm"
                                                        className="gap-2"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        ACTIVATE
                                                    </Button>
                                                )}

                                                {!isDefault && (
                                                    <div className="flex-shrink-0">
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-6 h-6 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="w-6 h-6 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ContextMenu.Trigger>

                            <ContextMenu.Content>
                                {!isDefault && (
                                    <>
                                        <ContextMenu.Item onClick={() => onEdit(list)}>
                                            <Pencil className="w-4 h-4" />
                                            RENAME
                                        </ContextMenu.Item>
                                        <ContextMenu.Separator />
                                        <ContextMenu.Item
                                            onClick={() => onDelete(list)}
                                            variant="destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            DELETE
                                        </ContextMenu.Item>
                                    </>
                                )}
                                {isDefault && (
                                    <ContextMenu.Item disabled>
                                        <span className="opacity-50">
                                            Cannot edit default list
                                        </span>
                                    </ContextMenu.Item>
                                )}
                            </ContextMenu.Content>
                        </ContextMenu>

                        {isExpanded && !isDefault && (
                            <div className="border-t-4 border-border p-4 bg-background">
                                <ListManageGames
                                    listId={list.id}
                                    listType={list.type}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
