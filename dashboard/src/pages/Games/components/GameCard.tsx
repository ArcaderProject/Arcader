import { useState } from "react";
import { ContextMenu } from "@/components/retroui/ContextMenu";
import { Button } from "@/components/retroui/Button";
import {
    MoreVertical,
    Play,
    Pencil,
    Image as ImageIcon,
    Settings,
    Trash2,
    Search,
    GamepadIcon,
} from "lucide-react";

interface Game {
    id: string;
    name: string;
    filename: string;
    extension: string;
    console: string;
    core: string;
    cover_art: number;
    created_at: string;
}

interface GameCardProps {
    game: Game;
    coverUrl?: string;
    onRemoteStart: (game: Game) => void;
    onRename: (game: Game) => void;
    onUpdateCover: (game: Game) => void;
    onLookupCover: (game: Game) => void;
    onChangeCore: (game: Game) => void;
    onDelete: (game: Game) => void;
}

export const GameCard = ({
    game,
    coverUrl,
    onRemoteStart,
    onRename,
    onUpdateCover,
    onLookupCover,
    onChangeCore,
    onDelete,
}: GameCardProps) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <ContextMenu>
            <ContextMenu.Trigger asChild>
                <div
                    className="group relative"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <div className="relative border-4 border-foreground bg-background shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 cursor-pointer overflow-hidden">
                        <div
                            className="relative w-full"
                            style={{ aspectRatio: "2/3" }}
                        >
                            {game.cover_art && coverUrl ? (
                                <img
                                    src={coverUrl}
                                    alt={game.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <GamepadIcon className="w-16 h-16 text-muted-foreground" />
                                </div>
                            )}

                            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/20" />
                            <div
                                className="absolute inset-0 pointer-events-none opacity-10"
                                style={{
                                    backgroundImage:
                                        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
                                }}
                            />

                            <div className="absolute top-2 right-2 z-10">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 bg-background/90 backdrop-blur-sm hover:bg-background border-2 shadow-lg"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const rect =
                                            e.currentTarget.getBoundingClientRect();
                                        const contextMenuEvent = new MouseEvent(
                                            "contextmenu",
                                            {
                                                bubbles: true,
                                                cancelable: true,
                                                view: window,
                                                clientX: rect.left,
                                                clientY: rect.bottom,
                                            },
                                        );
                                        e.currentTarget
                                            .closest(".group")
                                            ?.dispatchEvent(contextMenuEvent);
                                    }}
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </div>

                            {isHovered && (
                                <div
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200"
                                    onClick={() => onRemoteStart(game)}
                                >
                                    <div className="w-20 h-20 rounded-full border-4 border-primary bg-background/90 flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                                        <Play className="w-10 h-10 text-primary fill-primary ml-1" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-background border-t-4 border-foreground p-3">
                            <h3 className="font-head text-sm md:text-base font-bold truncate tracking-wide">
                                {game.name}
                            </h3>
                        </div>
                    </div>
                </div>
            </ContextMenu.Trigger>

            <ContextMenu.Content>
                <ContextMenu.Item onClick={() => onRemoteStart(game)}>
                    <Play className="w-4 h-4" />
                    Remote Start
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item onClick={() => onRename(game)}>
                    <Pencil className="w-4 h-4" />
                    Rename
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => onUpdateCover(game)}>
                    <ImageIcon className="w-4 h-4" />
                    {game.cover_art ? "Update Cover" : "Upload Cover"}
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => onLookupCover(game)}>
                    <Search className="w-4 h-4" />
                    Lookup Cover
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => onChangeCore(game)}>
                    <Settings className="w-4 h-4" />
                    Change Core
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item
                    variant="destructive"
                    onClick={() => onDelete(game)}
                >
                    <Trash2 className="w-4 h-4" />
                    Delete
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu>
    );
};
