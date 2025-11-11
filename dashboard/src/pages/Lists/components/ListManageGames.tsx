import { useState, useEffect } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { getRequest, putRequest } from "@/common/utils/RequestUtil";
import {
    ChevronRight,
    ChevronLeft,
    ChevronsRight,
    ChevronsLeft,
    Search,
} from "lucide-react";
import { toast } from "sonner";

interface Game {
    id: string;
    name: string;
    console: string;
}

interface ListManageGamesProps {
    listId: string;
    listType: "include" | "exclude";
    onSaved?: () => void;
}

export const ListManageGames = ({ listId, listType, onSaved }: ListManageGamesProps) => {
    const [allGames, setAllGames] = useState<Game[]>([]);
    const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
    const [rightSelected, setRightSelected] = useState<Set<string>>(new Set());

    const [leftSearch, setLeftSearch] = useState("");
    const [rightSearch, setRightSearch] = useState("");

    useEffect(() => {
        loadData();
    }, [listId]);

    const loadData = async () => {
        setLoading(true);

        try {
            const [games, listGamesData] = await Promise.all([
                getRequest("games"),
                getRequest(`lists/${listId}/games`),
            ]);

            setAllGames(games);
            setSelectedGameIds(new Set(listGamesData.gameIds));
        } catch (err) {
            console.error("Failed to load data:", err);
            toast.error("Failed to load games");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            await putRequest(`lists/${listId}/games`, {
                gameIds: Array.from(selectedGameIds),
            });
            toast.success("Games updated successfully");
            if (onSaved) onSaved();
        } catch (err: any) {
            console.error("Failed to save:", err);
            toast.error(err?.error || "Failed to update games");
        } finally {
            setSaving(false);
        }
    };

    const moveToRight = () => {
        const newSelectedIds = new Set(selectedGameIds);
        leftSelected.forEach((id) => newSelectedIds.add(id));
        setSelectedGameIds(newSelectedIds);
        setLeftSelected(new Set());
    };

    const moveAllToRight = () => {
        const availableGames = allGames.filter(
            (game) => !selectedGameIds.has(game.id),
        );
        const newSelectedIds = new Set(selectedGameIds);
        availableGames.forEach((game) => newSelectedIds.add(game.id));
        setSelectedGameIds(newSelectedIds);
        setLeftSelected(new Set());
    };

    const moveToLeft = () => {
        const newSelectedIds = new Set(selectedGameIds);
        rightSelected.forEach((id) => newSelectedIds.delete(id));
        setSelectedGameIds(newSelectedIds);
        setRightSelected(new Set());
    };

    const moveAllToLeft = () => {
        setSelectedGameIds(new Set());
        setRightSelected(new Set());
    };

    const toggleLeftSelection = (gameId: string) => {
        const newSet = new Set(leftSelected);
        if (newSet.has(gameId)) {
            newSet.delete(gameId);
        } else {
            newSet.add(gameId);
        }
        setLeftSelected(newSet);
    };

    const toggleRightSelection = (gameId: string) => {
        const newSet = new Set(rightSelected);
        if (newSet.has(gameId)) {
            newSet.delete(gameId);
        } else {
            newSet.add(gameId);
        }
        setRightSelected(newSet);
    };

    const availableGames = allGames
        .filter((game) => !selectedGameIds.has(game.id))
        .filter((game) =>
            leftSearch
                ? game.name.toLowerCase().includes(leftSearch.toLowerCase()) ||
                  game.console.toLowerCase().includes(leftSearch.toLowerCase())
                : true,
        );

    const selectedGames = allGames
        .filter((game) => selectedGameIds.has(game.id))
        .filter((game) =>
            rightSearch
                ? game.name.toLowerCase().includes(rightSearch.toLowerCase()) ||
                  game.console.toLowerCase().includes(rightSearch.toLowerCase())
                : true,
        );

    const getPageText = () => {
        if (listType === "include") {
            return {
                leftTitle: "AVAILABLE GAMES",
                rightTitle: "INCLUDED GAMES",
            };
        } else {
            return {
                leftTitle: "AVAILABLE GAMES",
                rightTitle: "EXCLUDED GAMES",
            };
        }
    };

    const pageText = getPageText();

    const renderGameList = (
        games: Game[],
        selectedSet: Set<string>,
        onToggle: (id: string) => void,
        emptyMessage: string,
    ) => (
        <div className="border-2 border-border rounded flex-1 overflow-y-auto bg-background max-h-[400px]">
            {games.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm font-head opacity-70 p-8">
                    {emptyMessage}
                </div>
            ) : (
                games.map((game) => {
                    const isSelected = selectedSet.has(game.id);
                    return (
                        <div
                            key={game.id}
                            className={`flex items-center gap-3 p-3 border-b-2 border-border last:border-b-0 cursor-pointer transition hover:bg-primary/10 ${
                                isSelected ? "bg-primary/20" : ""
                            }`}
                            onClick={() => onToggle(game.id)}
                        >
                            <div
                                className={`w-4 h-4 border-2 rounded flex-shrink-0 ${
                                    isSelected
                                        ? "bg-primary border-primary"
                                        : "border-border"
                                }`}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-head font-bold truncate">
                                    {game.name}
                                </div>
                                <div className="font-head text-xs opacity-70 truncate">
                                    {game.console}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-sm font-head text-muted-foreground">LOADING GAMES...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                <div className="flex flex-col space-y-3 min-h-0">
                    <div className="flex items-center justify-between">
                        <h3 className="font-head font-bold text-sm">
                            {pageText.leftTitle}
                        </h3>
                        <span className="font-head text-xs opacity-70">
                            {availableGames.length}
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <Input
                            placeholder="SEARCH..."
                            value={leftSearch}
                            onChange={(e) => setLeftSearch(e.target.value)}
                            className="pl-10 uppercase placeholder:normal-case h-10"
                        />
                    </div>
                    {renderGameList(
                        availableGames,
                        leftSelected,
                        toggleLeftSelection,
                        "NO GAMES",
                    )}
                    <div className="text-xs font-head opacity-70 h-5">
                        {leftSelected.size > 0 &&
                            `${leftSelected.size} SELECTED`}
                    </div>
                </div>

                <div className="flex flex-col justify-center gap-2 min-w-[100px]">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={moveAllToRight}
                        disabled={availableGames.length === 0}
                        className="w-full"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        onClick={moveToRight}
                        disabled={leftSelected.size === 0}
                        className="w-full"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        onClick={moveToLeft}
                        disabled={rightSelected.size === 0}
                        className="w-full"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={moveAllToLeft}
                        disabled={selectedGames.length === 0}
                        className="w-full"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex flex-col space-y-3 min-h-0">
                    <div className="flex items-center justify-between">
                        <h3 className="font-head font-bold text-sm">
                            {pageText.rightTitle}
                        </h3>
                        <span className="font-head text-xs opacity-70">
                            {selectedGames.length}
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <Input
                            placeholder="SEARCH..."
                            value={rightSearch}
                            onChange={(e) => setRightSearch(e.target.value)}
                            className="pl-10 uppercase placeholder:normal-case h-10"
                        />
                    </div>
                    {renderGameList(
                        selectedGames,
                        rightSelected,
                        toggleRightSelection,
                        listType === "include" ? "NO GAMES" : "NO GAMES",
                    )}
                    <div className="text-xs font-head opacity-70 h-5">
                        {rightSelected.size > 0 &&
                            `${rightSelected.size} SELECTED`}
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "SAVING..." : "SAVE CHANGES"}
                </Button>
            </div>
        </div>
    );
};
