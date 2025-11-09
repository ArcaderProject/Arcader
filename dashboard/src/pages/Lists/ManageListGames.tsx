import { useState, useEffect } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { useNavigate, useParams } from "react-router-dom";
import { getRequest } from "@/common/utils/RequestUtil";
import {
    ChevronRight,
    ChevronLeft,
    ChevronsRight,
    ChevronsLeft,
    Search,
    ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { putRequest } from "@/common/utils/RequestUtil";

interface Game {
    id: string;
    name: string;
    console: string;
}

interface GameList {
    id: string;
    name: string;
    type: "include" | "exclude";
    is_default: number;
}

export const ManageListGames = () => {
    const { listId } = useParams<{ listId: string }>();
    const navigate = useNavigate();

    const [list, setList] = useState<GameList | null>(null);
    const [allGames, setAllGames] = useState<Game[]>([]);
    const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(
        new Set(),
    );
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
        if (!listId) return;

        setLoading(true);

        try {
            const [listData, games, listGamesData] = await Promise.all([
                getRequest(`lists`).then((lists) =>
                    lists.find((l: GameList) => l.id === listId),
                ),
                getRequest("games"),
                getRequest(`lists/${listId}/games`),
            ]);

            if (!listData) {
                toast.error("List not found");
                navigate("/lists");
                return;
            }

            setList(listData);
            setAllGames(games);
            setSelectedGameIds(new Set(listGamesData.gameIds));
        } catch (err) {
            console.error("Failed to load data:", err);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!listId) return;

        setSaving(true);

        try {
            await putRequest(`lists/${listId}/games`, {
                gameIds: Array.from(selectedGameIds),
            });
            toast.success("Games updated successfully");
            navigate("/lists");
        } catch (err: any) {
            console.error("Failed to save:", err);
            toast.error(err?.error || "Failed to update games");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        navigate("/lists");
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
        if (!list) return { leftTitle: "", rightTitle: "" };

        if (list.type === "include") {
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
        <div className="border-2 rounded flex-1 overflow-y-auto">
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
                            className={`flex items-center gap-3 p-3 border-b-2 last:border-b-0 cursor-pointer transition hover:bg-primary/10 ${
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
            <div className="flex items-center justify-center h-full">
                <div className="text-xl font-head">LOADING...</div>
            </div>
        );
    }

    if (!list) {
        return null;
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        BACK
                    </Button>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-head font-bold">
                            {list.name.toUpperCase()}
                        </h1>
                        <p className="text-sm font-head mt-1 opacity-70">
                            {list.type === "include"
                                ? "INCLUDE MODE"
                                : "EXCLUDE MODE"}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancel}>
                        CANCEL
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "SAVING..." : "SAVE"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 flex-1 min-h-0">
                <div className="flex flex-col space-y-3 min-h-0">
                    <div className="flex items-center justify-between">
                        <h3 className="font-head font-bold text-lg">
                            {pageText.leftTitle}
                        </h3>
                        <span className="font-head text-sm opacity-70">
                            {availableGames.length}
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <Input
                            placeholder="SEARCH..."
                            value={leftSearch}
                            onChange={(e) => setLeftSearch(e.target.value)}
                            className="pl-10 uppercase placeholder:normal-case"
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
                        <h3 className="font-head font-bold text-lg">
                            {pageText.rightTitle}
                        </h3>
                        <span className="font-head text-sm opacity-70">
                            {selectedGames.length}
                        </span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <Input
                            placeholder="SEARCH..."
                            value={rightSearch}
                            onChange={(e) => setRightSearch(e.target.value)}
                            className="pl-10 uppercase placeholder:normal-case"
                        />
                    </div>
                    {renderGameList(
                        selectedGames,
                        rightSelected,
                        toggleRightSelection,
                        list.type === "include" ? "NO GAMES" : "NO GAMES",
                    )}
                    <div className="text-xs font-head opacity-70 h-5">
                        {rightSelected.size > 0 &&
                            `${rightSelected.size} SELECTED`}
                    </div>
                </div>
            </div>
        </div>
    );
};
