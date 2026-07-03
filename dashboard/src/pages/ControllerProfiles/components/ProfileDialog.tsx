import { Dialog } from "@/components/retroui/Dialog";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import { useEffect, useState } from "react";

interface ProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialName?: string;
    mode: "create" | "rename";
    onConfirm: (name: string) => Promise<void>;
}

export const ProfileDialog = ({
    open,
    onOpenChange,
    initialName,
    mode,
    onConfirm,
}: ProfileDialogProps) => {
    const [name, setName] = useState(initialName || "");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setName(initialName || "");
            setError(null);
        }
    }, [open, initialName]);

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
            setError(err?.error || "Failed to save profile");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenChange = (next: boolean) => {
        if (!submitting) {
            setError(null);
            onOpenChange(next);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Dialog.Content size="md">
                <Dialog.Header>
                    <h2 className="text-xl font-head font-bold">
                        {mode === "create"
                            ? "NEW CONTROLLER PROFILE"
                            : "RENAME PROFILE"}
                    </h2>
                </Dialog.Header>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block mb-2 font-head text-sm">
                            NAME
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Fighting Sticks"
                            disabled={submitting}
                            aria-invalid={!!error}
                        />
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
                        {submitting
                            ? "SAVING..."
                            : mode === "create"
                              ? "CREATE"
                              : "SAVE"}
                    </Button>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog>
    );
};
