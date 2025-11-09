import { Card } from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { Play, StopCircle } from "lucide-react";

interface Game {
    id: string;
    name: string;
    console: string;
}

interface NowPlayingBannerProps {
    game: Game;
    onStop: () => void;
}

export const NowPlayingBanner = ({ game, onStop }: NowPlayingBannerProps) => (
    <Card className="mb-6 bg-primary/10 border-primary w-full">
        <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Play className="w-5 h-5 text-primary animate-pulse" />
                    <span className="font-head font-bold text-primary">NOW PLAYING:</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{game.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{game.console}</p>
                </div>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={onStop}
                className="gap-2 flex-shrink-0 ml-4"
            >
                <StopCircle className="w-4 h-4" />
                STOP
            </Button>
        </div>
    </Card>
);
