import { useState, useEffect } from "react";
import { Dialog } from "@/components/retroui/Dialog";
import { Button } from "@/components/retroui/Button";
import { Loader2, Search } from "lucide-react";

interface CoverOption {
    id: number;
    url: string;
    thumb: string;
    width: number;
    height: number;
}

interface LookupCoverDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    gameId: string;
    gameName: string;
    onSelectCover: (coverUrl: string) => void;
}

export const LookupCoverDialog = ({
    open,
    onOpenChange,
    gameId,
    gameName,
    onSelectCover,
}: LookupCoverDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [covers, setCovers] = useState<CoverOption[]>([]);
    const [selectedCover, setSelectedCover] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && gameId) {
            loadCovers();
        } else {
            setCovers([]);
            setSelectedCover(null);
            setError(null);
        }
    }, [open, gameId]);

    const loadCovers = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("sessionToken");
            const response = await fetch(`/api/games/${gameId}/lookup-covers`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to lookup covers");
            }

            const data = await response.json();
            setCovers(data.covers || []);

            if (data.covers.length === 0) {
                setError("No covers found for this game");
            }
        } catch (err: any) {
            console.error("Failed to lookup covers:", err);
            setError(err.message || "Failed to lookup covers");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCover = () => {
        if (selectedCover) {
            onSelectCover(selectedCover);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Dialog.Content size="xl">
                <Dialog.Header>LOOKUP COVER - {gameName}</Dialog.Header>
                <div className="p-6 space-y-4">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                            <p className="text-muted-foreground">
                                SEARCHING STEAMGRIDDB...
                            </p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Search className="w-12 h-12 text-muted-foreground" />
                            <p className="text-destructive font-head">
                                {error}
                            </p>
                            <Button onClick={loadCovers} variant="outline">
                                RETRY
                            </Button>
                        </div>
                    )}

                    {!loading && !error && covers.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-h-[60vh] overflow-hidden pr-2">
                                {covers.map((cover) => (
                                    <button
                                        key={cover.id}
                                        onClick={() =>
                                            setSelectedCover(cover.url)
                                        }
                                        className={`relative border-4 transition-all hover:brightness-110 ${
                                            selectedCover === cover.url
                                                ? "border-primary shadow-lg shadow-primary/50"
                                                : "border-muted hover:border-foreground"
                                        }`}
                                        style={{ aspectRatio: "2/3" }}
                                    >
                                        <img
                                            src={cover.thumb}
                                            alt={`Cover ${cover.id}`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                        {selectedCover === cover.url && (
                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                <div className="w-8 h-8 rounded-full bg-primary border-4 border-background flex items-center justify-center">
                                                    <svg
                                                        className="w-5 h-5 text-background"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={3}
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-end gap-4 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    CANCEL
                                </Button>
                                <Button
                                    onClick={handleSelectCover}
                                    disabled={!selectedCover}
                                >
                                    SELECT COVER
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Dialog.Content>
        </Dialog>
    );
};
