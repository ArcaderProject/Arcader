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

interface ProfileManageGamesProps {
    profileId: string;
    onSaved?: () => void;
}

export const ProfileManageGames = ({
    profileId,
    onSaved,
}: ProfileManageGamesProps) => {
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
    }, [profileId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [games, profileGamesData] = await Promise.all([
                getRequest("games"),
                getRequest(`controller-profiles/${profileId}/games`),
            ]);
            setAllGames(games);
            setSelectedGameIds(new Set(profileGamesData.gameIds));
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
            await putRequest(`controller-profiles/${profileId}/games`, {
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
        const next = new Set(selectedGameIds);
        leftSelected.forEach((id) => next.add(id));
        setSelectedGameIds(next);
        setLeftSelected(new Set());
    };

    const moveAllToRight = () => {
        const available = allGames.filter(
            (game) => !selectedGameIds.has(game.id),
        );
        const next = new Set(selectedGameIds);
        available.forEach((game) => next.add(game.id));
        setSelectedGameIds(next);
        setLeftSelected(new Set());
    };

    const moveToLeft = () => {
        const next = new Set(selectedGameIds);
        rightSelected.forEach((id) => next.delete(id));
        setSelectedGameIds(next);
        setRightSelected(new Set());
    };

    const moveAllToLeft = () => {
        setSelectedGameIds(new Set());
        setRightSelected(new Set());
    };

    const toggleLeftSelection = (gameId: string) => {
        const next = new Set(leftSelected);
        next.has(gameId) ? next.delete(gameId) : next.add(gameId);
        setLeftSelected(next);
    };

    const toggleRightSelection = (gameId: string) => {
        const next = new Set(rightSelected);
        next.has(gameId) ? next.delete(gameId) : next.add(gameId);
        setRightSelected(next);
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
                <div className="text-sm font-head text-muted-foreground">
                    LOADING GAMES...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-xs font-head opacity-70">
                Games assigned here use this controller layout. Everything else
                falls back to the Global / Default profile. A game can only
                belong to one profile.
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                <div className="flex flex-col space-y-3 min-h-0">
                    <div className="flex items-center justify-between">
                        <h3 className="font-head font-bold text-sm">
                            AVAILABLE GAMES
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
                        {leftSelected.size > 0 && `${leftSelected.size} SELECTED`}
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
                            USING THIS PROFILE
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
                        "NO GAMES",
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
