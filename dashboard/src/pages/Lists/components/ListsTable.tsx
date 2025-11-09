import { Table } from "@/components/retroui/Table";
import { ContextMenu } from "@/components/retroui/ContextMenu";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import {
    MoreVertical,
    Pencil,
    Trash2,
    ListChecks,
} from "lucide-react";
import type { GameList } from "../hooks/useLists";

interface ListsTableProps {
    lists: GameList[];
    selectedList: GameList | null;
    onSelect: (list: GameList) => void;
    onEdit: (list: GameList) => void;
    onManageGames: (list: GameList) => void;
    onDelete: (list: GameList) => void;
}

export const ListsTable = ({
    lists,
    selectedList,
    onSelect,
    onEdit,
    onManageGames,
    onDelete,
}: ListsTableProps) => (
    <Card className="w-full">
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head className="w-12"></Table.Head>
                    <Table.Head>NAME</Table.Head>
                    <Table.Head className="hidden md:table-cell">
                        TYPE
                    </Table.Head>
                    <Table.Head className="hidden md:table-cell w-32">
                        GAMES
                    </Table.Head>
                    <Table.Head className="w-16 md:w-20"></Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {lists.map((list) => {
                    const isSelected = selectedList?.id === list.id;
                    const isDefault = list.is_default === 1;

                    return (
                        <ContextMenu key={list.id}>
                            <ContextMenu.Trigger asChild>
                                <Table.Row
                                    className={`cursor-pointer ${
                                        isSelected ? "bg-primary/20" : ""
                                    }`}
                                    onClick={() => !isSelected && onSelect(list)}
                                >
                                    <Table.Cell>
                                        <div
                                            className={`w-6 h-6 border-2 flex items-center justify-center ${
                                                isSelected
                                                    ? "bg-primary border-primary"
                                                    : "border-border"
                                            }`}
                                        >
                                            {isSelected && (
                                                <div className="w-2 h-2 bg-primary-foreground" />
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <span>{list.name}</span>
                                            {isDefault && (
                                                <span className="text-xs px-2 py-0.5 bg-muted border-2 rounded font-head">
                                                    DEFAULT
                                                </span>
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell className="hidden md:table-cell uppercase">
                                        {list.type}
                                    </Table.Cell>
                                    <Table.Cell className="hidden md:table-cell">
                                        {list.item_count || 0}
                                    </Table.Cell>
                                    <Table.Cell onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const rect =
                                                    e.currentTarget.getBoundingClientRect();
                                                const contextMenuEvent =
                                                    new MouseEvent(
                                                        "contextmenu",
                                                        {
                                                            bubbles: true,
                                                            cancelable: true,
                                                            view: window,
                                                            clientX: rect.left,
                                                            clientY: rect.bottom,
                                                        }
                                                    );
                                                e.currentTarget
                                                    .closest("tr")
                                                    ?.dispatchEvent(
                                                        contextMenuEvent
                                                    );
                                            }}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </Table.Cell>
                                </Table.Row>
                            </ContextMenu.Trigger>
                            <ContextMenu.Content>
                                {!isDefault && (
                                    <>
                                        <ContextMenu.Item
                                            onClick={() => onEdit(list)}
                                        >
                                            <Pencil className="w-4 h-4" />
                                            Rename
                                        </ContextMenu.Item>
                                        <ContextMenu.Item
                                            onClick={() => onManageGames(list)}
                                        >
                                            <ListChecks className="w-4 h-4" />
                                            Manage
                                        </ContextMenu.Item>
                                        <ContextMenu.Separator />
                                        <ContextMenu.Item
                                            onClick={() => onDelete(list)}
                                            variant="destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </ContextMenu.Item>
                                    </>
                                )}
                                {isDefault && (
                                    <ContextMenu.Item disabled>
                                        <span className="opacity-50">
                                            Cannot edit default
                                        </span>
                                    </ContextMenu.Item>
                                )}
                            </ContextMenu.Content>
                        </ContextMenu>
                    );
                })}
            </Table.Body>
        </Table>
    </Card>
);
