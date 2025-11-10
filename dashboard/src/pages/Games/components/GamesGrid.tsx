import { GameCard } from "./GameCard";

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

interface GamesGridProps {
    games: Game[];
    coverUrls: Record<string, string>;
    onRemoteStart: (game: Game) => void;
    onRename: (game: Game) => void;
    onUpdateCover: (game: Game) => void;
    onLookupCover: (game: Game) => void;
    onChangeCore: (game: Game) => void;
    onDelete: (game: Game) => void;
}

export const GamesGrid = ({
    games,
    coverUrls,
    onRemoteStart,
    onRename,
    onUpdateCover,
    onLookupCover,
    onChangeCore,
    onDelete,
}: GamesGridProps) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {games.map((game) => (
                <GameCard
                    key={game.id}
                    game={game}
                    coverUrl={coverUrls[game.id]}
                    onRemoteStart={onRemoteStart}
                    onRename={onRename}
                    onUpdateCover={onUpdateCover}
                    onLookupCover={onLookupCover}
                    onChangeCore={onChangeCore}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};
