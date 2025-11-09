import { useState } from "react";
import { Button } from "@/components/retroui/Button";
import { ConfirmDialog } from "@/components/retroui/ConfirmDialog";
import { Upload } from "lucide-react";
import { CoreSelectorDialog } from "./components/CoreSelectorDialog";
import { NowPlayingBanner } from "./components/NowPlayingBanner";
import { EmptyState } from "./components/EmptyState";
import { GamesTable } from "./components/GamesTable";
import { UploadDialog } from "./components/UploadDialog";
import { RenameDialog } from "./components/RenameDialog";
import { CoverDialog } from "./components/CoverDialog";
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
        renameGame,
        deleteGame,
        startGame,
    } = useGames();

    const { currentlyPlaying, loadCurrentlyPlaying, stopGame } =
        useCurrentlyPlaying();

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [coverDialogOpen, setCoverDialogOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [coreSelectorOpen, setCoreSelectorOpen] = useState(false);
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);
    const [newName, setNewName] = useState("");
    const [isDraggingRom, setIsDraggingRom] = useState(false);
    const [isDraggingCover, setIsDraggingCover] = useState(false);

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
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl md:text-4xl font-head font-bold">
                    GAMES
                </h1>
                <Button
                    onClick={() => setUploadDialogOpen(true)}
                    className="gap-2"
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
            ) : (
                <GamesTable
                    games={games}
                    coverUrls={coverUrls}
                    onRemoteStart={handleRemoteStart}
                    onRename={openRenameDialog}
                    onUpdateCover={openCoverDialog}
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
