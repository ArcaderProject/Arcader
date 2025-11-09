import { useState, useEffect } from "react";
import { Dialog } from "@/components/retroui/Dialog";
import { Button } from "@/components/retroui/Button";
import { RadioGroup } from "@/components/retroui/Radio";
import { Text } from "@/components/retroui/Text";
import { toast } from "sonner";
import { getRequest, putRequest } from "@/common/utils/RequestUtil";

interface Core {
    display_name: string;
    core: string;
    extensions: string[];
    systemname: string;
    corename: string;
}

interface Game {
    id: string;
    name: string;
    extension: string;
    core: string;
}

interface CoreSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    game: Game | null;
    onCoreChanged: () => void;
}

export const CoreSelectorDialog = ({
    open,
    onOpenChange,
    game,
    onCoreChanged,
}: CoreSelectorDialogProps) => {
    const [cores, setCores] = useState<Core[]>([]);
    const [selectedCore, setSelectedCore] = useState<string>("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && game) {
            loadCores();
            setSelectedCore(game.core);
        }
    }, [open, game]);

    const loadCores = async () => {
        if (!game) return;

        try {
            const response = await getRequest(`games/${game.id}/cores`);
            setCores(response);
        } catch (error) {
            console.error("Failed to load cores:", error);
            toast.error("Failed to load available cores");
        }
    };

    const handleSave = async () => {
        if (!game || !selectedCore) return;

        setLoading(true);
        try {
            await putRequest(`games/${game.id}/core`, { core: selectedCore });

            toast.success("Core updated successfully");
            onCoreChanged();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update core:", error);
            toast.error("Failed to update core");
        } finally {
            setLoading(false);
        }
    };

    if (!game) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Dialog.Content className="max-w-md">
                <Dialog.Header>
                    <Text as="h3">Select Emulator Core</Text>
                </Dialog.Header>

                <div className="py-6 px-2">
                    <RadioGroup
                        value={selectedCore}
                        onValueChange={setSelectedCore}
                        className="gap-3"
                    >
                        {cores.map((core) => (
                            <div
                                key={core.core}
                                className="flex items-start gap-3 p-4 border-2 border-border hover:bg-primary/10 cursor-pointer"
                                onClick={() => setSelectedCore(core.core)}
                            >
                                <RadioGroup.Item
                                    value={core.core}
                                    id={core.core}
                                    className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                    <label
                                        htmlFor={core.core}
                                        className="cursor-pointer block"
                                    >
                                        <Text className="font-bold mb-1">
                                            {core.display_name}
                                        </Text>
                                        <Text className="text-sm opacity-70">
                                            {core.corename || core.systemname}
                                        </Text>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </RadioGroup>

                    {cores.length === 0 && (
                        <Text className="text-center py-8 opacity-70">
                            No cores available for this game type
                        </Text>
                    )}
                </div>

                <Dialog.Footer>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading || !selectedCore}
                    >
                        {loading ? "Saving..." : "Save"}
                    </Button>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog>
    );
};
