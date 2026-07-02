import { Dialog } from "@/components/retroui/Dialog";
import { Button } from "@/components/retroui/Button";
import { FileArchive, Check, X } from "lucide-react";
import type { PendingArchive } from "../hooks/useGames";

interface ArchiveImportDialogProps {
    open: boolean;
    archive: PendingArchive | null;
    onExtract: () => void;
    onInstall: () => void;
    onCancel: () => void;
}

export const ArchiveImportDialog = ({
    open,
    archive,
    onExtract,
    onInstall,
    onCancel,
}: ArchiveImportDialogProps) => {
    const entries = archive?.entries ?? [];
    const supportedCount = archive?.supportedCount ?? 0;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
            <Dialog.Content size="md">
                <Dialog.Header>ARCHIVE DETECTED</Dialog.Header>
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <FileArchive className="w-6 h-6 text-primary" />
                        <p className="font-head break-all">{archive?.filename}</p>
                    </div>
                    <p className="text-foreground">
                        This looks like an archive. Extract its contents and
                        install each recognised game, or install the archive
                        directly as a single ROM?
                    </p>

                    {entries.length > 0 && (
                        <div className="border-4 border-muted max-h-52 overflow-y-auto">
                            {entries.map((entry) => (
                                <div
                                    key={entry.name}
                                    className="flex items-center justify-between gap-3 px-3 py-2 border-b-2 border-muted last:border-b-0"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {entry.supported ? (
                                            <Check className="w-4 h-4 text-primary shrink-0" />
                                        ) : (
                                            <X className="w-4 h-4 text-muted-foreground shrink-0" />
                                        )}
                                        <span
                                            className={`truncate ${
                                                entry.supported
                                                    ? ""
                                                    : "text-muted-foreground line-through"
                                            }`}
                                            title={entry.name}
                                        >
                                            {entry.name}
                                        </span>
                                    </div>
                                    {entry.supported && entry.console && (
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            {entry.console}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="text-sm text-muted-foreground">
                        {supportedCount > 0
                            ? `${supportedCount} recognised game${
                                  supportedCount === 1 ? "" : "s"
                              } will be installed on extract.`
                            : "No recognised games found — extraction will install nothing."}
                    </p>
                </div>
                <Dialog.Footer>
                    <Button variant="outline" onClick={onCancel}>
                        CANCEL
                    </Button>
                    <Button variant="secondary" onClick={onInstall}>
                        INSTALL DIRECTLY
                    </Button>
                    <Button
                        onClick={onExtract}
                        disabled={supportedCount === 0}
                    >
                        EXTRACT & INSTALL
                    </Button>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog>
    );
};
