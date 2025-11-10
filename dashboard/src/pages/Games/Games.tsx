import { useState, useMemo } from "react";
import { Button } from "@/components/retroui/Button";
import { ConfirmDialog } from "@/components/retroui/ConfirmDialog";
import { Upload, Search } from "lucide-react";
import { CoreSelectorDialog } from "./components/CoreSelectorDialog";
import { NowPlayingBanner } from "./components/NowPlayingBanner";
import { EmptyState } from "./components/EmptyState";
import { GamesGrid } from "./components/GamesGrid";
import { UploadDialog } from "./components/UploadDialog";
import { RenameDialog } from "./components/RenameDialog";
import { CoverDialog } from "./components/CoverDialog";
import { LookupCoverDialog } from "./components/LookupCoverDialog";
import { useGames, type Game } from "./hooks/useGames";
import { useCurrentlyPlaying } from "./hooks/useCurrentlyPlaying";

export const Games = () => {
    const {
        games,
        loading,
        coverUrls,
        loadGames,
        uploadRom,
        uploadCover,
        selectCoverFromUrl,
        renameGame,
        deleteGame,
        startGame,
    } = useGames();

    const { currentlyPlaying, loadCurrentlyPlaying, stopGame } =
        useCurrentlyPlaying();

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [coverDialogOpen, setCoverDialogOpen] = useState(false);
    const [lookupCoverDialogOpen, setLookupCoverDialogOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [coreSelectorOpen, setCoreSelectorOpen] = useState(false);
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [newName, setNewName] = useState("");
    const [isDraggingRom, setIsDraggingRom] = useState(false);
    const [isDraggingCover, setIsDraggingCover] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Filter games based on search query
    const filteredGames = useMemo(() => {
        if (!searchQuery.trim()) return games;
        
        const query = searchQuery.toLowerCase();
        return games.filter(
            (game) =>
                game.name.toLowerCase().includes(query) ||
                game.console.toLowerCase().includes(query)
        );
    }, [games, searchQuery]);

    const handleUploadRom = async (file: File) => {
        await uploadRom(file);
        setUploadDialogOpen(false);
    };

    const handleUploadCover = async (file: File) => {
        if (!selectedGame) return;
        await uploadCover(selectedGame.id, file);
        setCoverDialogOpen(false);
    };

    const handleRename = async () => {
        if (!selectedGame || !newName.trim()) return;
        await renameGame(selectedGame.id, newName);
        setRenameDialogOpen(false);
        setNewName("");
    };

    const handleDelete = async () => {
        if (!selectedGame) return;
        await deleteGame(selectedGame.id);
    };

    const handleRemoteStart = async (game: Game) => {
        await startGame(game.id, game.name);
        loadCurrentlyPlaying();
    };

    const openRenameDialog = (game: Game) => {
        setSelectedGame(game);
        setNewName(game.name);
        setRenameDialogOpen(true);
    };

    const openCoverDialog = (game: Game) => {
        setSelectedGame(game);
        setCoverDialogOpen(true);
    };

    const openLookupCoverDialog = (game: Game) => {
        setSelectedGame(game);
        setLookupCoverDialogOpen(true);
    };

    const handleSelectCoverFromLookup = async (coverUrl: string) => {
        if (!selectedGame) return;
        await selectCoverFromUrl(selectedGame.id, coverUrl);
    };

    const openCoreSelector = (game: Game) => {
        setSelectedGame(game);
        setCoreSelectorOpen(true);
    };

    const confirmDelete = (game: Game) => {
        setSelectedGame(game);
        setDeleteConfirmOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-xl font-head">LOADING GAMES...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="SEARCH GAMES..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border-4 border-foreground bg-background font-head text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/50 transition-all"
                    />
                </div>

                {/* Upload Button */}
                <Button
                    onClick={() => setUploadDialogOpen(true)}
                    className="gap-2 shrink-0"
                >
                    <Upload className="w-5 h-5" />
                    UPLOAD ROM
                </Button>
            </div>

            {currentlyPlaying.playing && currentlyPlaying.game && (
                <NowPlayingBanner
                    game={currentlyPlaying.game}
                    onStop={stopGame}
                />
            )}

            {games.length === 0 ? (
                <EmptyState onUpload={() => setUploadDialogOpen(true)} />
            ) : filteredGames.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <Search className="w-16 h-16 text-muted-foreground" />
                    <h3 className="text-2xl font-head font-bold">NO GAMES FOUND</h3>
                    <p className="text-muted-foreground">
                        No games match your search "{searchQuery}"
                    </p>
                </div>
            ) : (
                <GamesGrid
                    games={filteredGames}
                    coverUrls={coverUrls}
                    onRemoteStart={handleRemoteStart}
                    onRename={openRenameDialog}
                    onUpdateCover={openCoverDialog}
                    onLookupCover={openLookupCoverDialog}
                    onChangeCore={openCoreSelector}
                    onDelete={confirmDelete}
                />
            )}

            <UploadDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                onUpload={handleUploadRom}
                isDragging={isDraggingRom}
                onDragStart={() => setIsDraggingRom(true)}
                onDragEnd={() => setIsDraggingRom(false)}
            />

            <RenameDialog
                open={renameDialogOpen}
                onOpenChange={setRenameDialogOpen}
                name={newName}
                onNameChange={setNewName}
                onConfirm={handleRename}
            />

            <CoverDialog
                open={coverDialogOpen}
                onOpenChange={setCoverDialogOpen}
                onUpload={handleUploadCover}
                isDragging={isDraggingCover}
                onDragStart={() => setIsDraggingCover(true)}
                onDragEnd={() => setIsDraggingCover(false)}
            />

            <LookupCoverDialog
                open={lookupCoverDialogOpen}
                onOpenChange={setLookupCoverDialogOpen}
                gameId={selectedGame?.id || ""}
                gameName={selectedGame?.name || ""}
                onSelectCover={handleSelectCoverFromLookup}
            />

            <ConfirmDialog
                open={deleteConfirmOpen}
                onOpenChange={setDeleteConfirmOpen}
                title="DELETE GAME"
                description={`Are you sure you want to delete "${selectedGame?.name}"? This action cannot be undone.`}
                confirmLabel="DELETE"
                cancelLabel="CANCEL"
                onConfirm={handleDelete}
                variant="destructive"
            />

            <CoreSelectorDialog
                open={coreSelectorOpen}
                onOpenChange={setCoreSelectorOpen}
                game={selectedGame}
                onCoreChanged={loadGames}
            />
        </div>
    );
};
