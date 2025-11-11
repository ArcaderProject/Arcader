import { Dialog } from "@/components/retroui/Dialog";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";

interface RenameStorageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    name: string;
    onNameChange: (name: string) => void;
    onConfirm: () => void;
}

export const RenameStorageDialog = ({
    open,
    onOpenChange,
    name,
    onNameChange,
    onConfirm,
}: RenameStorageDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <Dialog.Content size="md">
            <Dialog.Header>RENAME STORAGE</Dialog.Header>
            <div className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-head font-bold mb-2 uppercase tracking-wider">
                        Storage Name
                    </label>
                    <Input
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="New name"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onConfirm();
                        }}
                        autoFocus
                    />
                </div>
            </div>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                >
                    CANCEL
                </Button>
                <Button onClick={onConfirm} disabled={!name.trim()}>
                    RENAME
                </Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog>
);
