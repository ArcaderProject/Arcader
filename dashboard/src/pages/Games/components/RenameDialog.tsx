import { Dialog } from "@/components/retroui/Dialog";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";

interface RenameDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    name: string;
    onNameChange: (name: string) => void;
    onConfirm: () => void;
}

export const RenameDialog = ({
    open,
    onOpenChange,
    name,
    onNameChange,
    onConfirm,
}: RenameDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <Dialog.Content size="md">
            <Dialog.Header>RENAME GAME</Dialog.Header>
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-head font-semibold">NEW NAME</label>
                    <Input
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="Enter new name"
                        onKeyDown={(e) => e.key === "Enter" && onConfirm()}
                    />
                </div>
            </div>
            <Dialog.Footer>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                    CANCEL
                </Button>
                <Button onClick={onConfirm} disabled={!name.trim()}>
                    SAVE
                </Button>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog>
);
