import { Table } from "@/components/retroui/Table";
import { ContextMenu } from "@/components/retroui/ContextMenu";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { GamepadIcon, MoreVertical, Play, Pencil, Image as ImageIcon, Settings, Trash2 } from "lucide-react";

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

interface GamesTableProps {
    games: Game[];
    coverUrls: Record<string, string>;
    onRemoteStart: (game: Game) => void;
    onRename: (game: Game) => void;
    onUpdateCover: (game: Game) => void;
    onChangeCore: (game: Game) => void;
    onDelete: (game: Game) => void;
}

export const GamesTable = ({
    games,
    coverUrls,
    onRemoteStart,
    onRename,
    onUpdateCover,
    onChangeCore,
    onDelete,
}: GamesTableProps) => (
    <Card className="w-full">
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head className="w-20 md:w-24">COVER</Table.Head>
                    <Table.Head>NAME</Table.Head>
                    <Table.Head className="hidden md:table-cell">CONSOLE</Table.Head>
                    <Table.Head className="w-16 md:w-20"></Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {games.map((game) => (
                    <ContextMenu key={game.id}>
                        <ContextMenu.Trigger asChild>
                            <Table.Row className="cursor-pointer">
                                <Table.Cell>
                                    <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-foreground bg-muted flex items-center justify-center overflow-hidden">
                                        {game.cover_art ? (
                                            <img
                                                src={coverUrls[game.id] || ""}
                                                alt={game.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <GamepadIcon className="w-6 h-6 text-muted-foreground" />
                                        )}
                                    </div>
                                </Table.Cell>
                                <Table.Cell className="font-medium">{game.name}</Table.Cell>
                                <Table.Cell className="hidden md:table-cell">{game.console}</Table.Cell>
                                <Table.Cell onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const contextMenuEvent = new MouseEvent("contextmenu", {
                                                bubbles: true,
                                                cancelable: true,
                                                view: window,
                                                clientX: rect.left,
                                                clientY: rect.bottom,
                                            });
                                            e.currentTarget.closest("tr")?.dispatchEvent(contextMenuEvent);
                                        }}
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
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
                            <ContextMenu.Item onClick={() => onChangeCore(game)}>
                                <Settings className="w-4 h-4" />
                                Change Core
                            </ContextMenu.Item>
                            <ContextMenu.Separator />
                            <ContextMenu.Item variant="destructive" onClick={() => onDelete(game)}>
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </ContextMenu.Item>
                        </ContextMenu.Content>
                    </ContextMenu>
                ))}
            </Table.Body>
        </Table>
    </Card>
);
