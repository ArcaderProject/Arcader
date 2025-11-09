import { Dialog } from "@/components/retroui/Dialog";
import { Input } from "@/components/retroui/Input";
import { Button } from "@/components/retroui/Button";
import { RadioGroup } from "@/components/retroui/Radio";
import { useState } from "react";

interface CreateListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (name: string, type: "include" | "exclude") => Promise<void>;
}

export const CreateListDialog = ({
    open,
    onOpenChange,
    onConfirm,
}: CreateListDialogProps) => {
    const [name, setName] = useState("");
    const [type, setType] = useState<"include" | "exclude">("exclude");
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
            await onConfirm(name.trim(), type);
            setName("");
            setType("exclude");
            onOpenChange(false);
        } catch (err: any) {
            setError(err?.error || "Failed to create list");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!submitting) {
            setName("");
            setType("exclude");
            setError(null);
            onOpenChange(open);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Dialog.Content size="md">
                <Dialog.Header>
                    <h2 className="text-xl font-head font-bold">
                        NEW LIST
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
                            placeholder="Enter name"
                            disabled={submitting}
                            aria-invalid={!!error}
                        />
                    </div>

                    <div>
                        <label className="block mb-2 font-head text-sm">
                            TYPE
                        </label>
                        <RadioGroup
                            value={type}
                            onValueChange={(value) =>
                                setType(value as "include" | "exclude")
                            }
                            disabled={submitting}
                            className="space-y-2"
                        >
                            <div className="flex items-center gap-2">
                                <RadioGroup.Item value="exclude" id="exclude" />
                                <label
                                    htmlFor="exclude"
                                    className="font-head cursor-pointer"
                                >
                                    EXCLUDE
                                </label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroup.Item value="include" id="include" />
                                <label
                                    htmlFor="include"
                                    className="font-head cursor-pointer"
                                >
                                    INCLUDE
                                </label>
                            </div>
                        </RadioGroup>
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
                        {submitting ? "CREATING..." : "CREATE"}
                    </Button>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog>
    );
};
