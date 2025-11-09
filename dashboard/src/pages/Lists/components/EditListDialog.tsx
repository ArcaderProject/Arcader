import { Dialog } from "@/components/retroui/Dialog";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import { useState } from "react";
import type { GameList } from "../hooks/useLists";

interface EditListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    list: GameList | null;
    onConfirm: (name: string) => Promise<void>;
}

export const EditListDialog = ({
    open,
    onOpenChange,
    list,
    onConfirm,
}: EditListDialogProps) => {
    const [name, setName] = useState(list?.name || "");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async () => {
        if (!name.trim()) {
            setError("Name is required");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onConfirm(name.trim());
            onOpenChange(false);
        } catch (err: any) {
            setError(err?.error || "Failed to update list");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!submitting) {
            setName(list?.name || "");
            setError(null);
            onOpenChange(open);
        }
    };

    useState(() => {
        setName(list?.name || "");
    });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Dialog.Content size="md">
                <Dialog.Header>
                    <h2 className="text-xl font-head font-bold">RENAME LIST</h2>
                </Dialog.Header>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block mb-2 font-head text-sm">
                            NAME
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter name"
                            disabled={submitting}
                            aria-invalid={!!error}
                        />
                    </div>

                    <div className="text-sm font-head opacity-70">
                        TYPE: {list?.type?.toUpperCase()}
                    </div>

                    {error && (
                        <p className="text-destructive text-sm font-head">
                            {error}
                        </p>
                    )}
                </div>

                <Dialog.Footer>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={submitting}
                    >
                        CANCEL
                    </Button>
                    <Button onClick={handleConfirm} disabled={submitting}>
                        {submitting ? "SAVING..." : "SAVE"}
                    </Button>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog>
    );
};
