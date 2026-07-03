import { useState } from "react";
import { ContextMenu } from "@/components/retroui/ContextMenu";
import { Button } from "@/components/retroui/Button";
import {
    Pencil,
    Trash2,
    ChevronDown,
    ChevronRight,
    Star,
    Gamepad2,
    Sliders,
    MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileManageGames } from "./ProfileManageGames";
import type { ControllerProfile } from "../hooks/useControllerProfiles";

const TOTAL_BINDS = 16;

interface ProfilesTableProps {
    profiles: ControllerProfile[];
    onConfigure: (profile: ControllerProfile) => void;
    onEdit: (profile: ControllerProfile) => void;
    onDelete: (profile: ControllerProfile) => void;
}

const bindingsSummary = (profile: ControllerProfile): string => {
    const bindings = profile.bindings || {};
    const players = Object.keys(bindings).sort();
    if (players.length === 0) return "Not configured yet";
    return players
        .map((player) => {
            const mapped = Object.keys(bindings[player] || {}).length;
            return `P${player}: ${mapped}/${TOTAL_BINDS}`;
        })
        .join("   ·   ");
};

export const ProfilesTable = ({
    profiles,
    onConfigure,
    onEdit,
    onDelete,
}: ProfilesTableProps) => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const toggleExpanded = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    return (
        <div className="space-y-3">
            {profiles.map((profile) => {
                const isExpanded = expanded.has(profile.id);
                const isDefault = profile.is_default === 1;

                return (
                    <div
                        key={profile.id}
                        className="border-4 border-border bg-secondary"
                    >
                        <ContextMenu>
                            <ContextMenu.Trigger asChild>
                                <div
                                    onClick={() =>
                                        !isDefault && toggleExpanded(profile.id)
                                    }
                                    className={cn(
                                        "group relative p-4 transition-all duration-200 bg-secondary",
                                        !isDefault &&
                                            "cursor-pointer hover:bg-primary/5",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="flex-shrink-0 w-12 h-12 border-2 border-border bg-background flex items-center justify-center">
                                                <Gamepad2 className="w-6 h-6 text-muted-foreground" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-head font-bold uppercase truncate">
                                                        {profile.name}
                                                    </h3>
                                                    {isDefault && (
                                                        <Star className="w-4 h-4 text-accent flex-shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                    {!isDefault && (
                                                        <span>
                                                            {profile.item_count ||
                                                                0}{" "}
                                                            games
                                                        </span>
                                                    )}
                                                    {isDefault && (
                                                        <span className="uppercase">
                                                            All other games
                                                        </span>
                                                    )}
                                                    <span>
                                                        {bindingsSummary(
                                                            profile,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onConfigure(profile);
                                                    }}
                                                    size="sm"
                                                    className="gap-2"
                                                >
                                                    <Sliders className="w-4 h-4" />
                                                    CONFIGURE LAYOUT
                                                </Button>

                                                {!isDefault && (
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 flex-shrink-0"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const rect =
                                                                e.currentTarget.getBoundingClientRect();
                                                            const contextMenuEvent =
                                                                new MouseEvent(
                                                                    "contextmenu",
                                                                    {
                                                                        bubbles: true,
                                                                        cancelable: true,
                                                                        view: window,
                                                                        clientX:
                                                                            rect.left,
                                                                        clientY:
                                                                            rect.bottom,
                                                                    },
                                                                );
                                                            e.currentTarget.dispatchEvent(
                                                                contextMenuEvent,
                                                            );
                                                        }}
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
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
                                        <ContextMenu.Item
                                            onClick={() => onEdit(profile)}
                                        >
                                            <Pencil className="w-4 h-4" />
                                            RENAME
                                        </ContextMenu.Item>
                                        <ContextMenu.Separator />
                                        <ContextMenu.Item
                                            onClick={() => onDelete(profile)}
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
                                            Cannot edit default profile
                                        </span>
                                    </ContextMenu.Item>
                                )}
                            </ContextMenu.Content>
                        </ContextMenu>

                        {isExpanded && !isDefault && (
                            <div className="border-t-4 border-border p-4 bg-background">
                                <ProfileManageGames profileId={profile.id} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
