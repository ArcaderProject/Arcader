import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
}

export const ConfirmDialog = ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "CONFIRM",
    cancelLabel = "CANCEL",
    onConfirm,
    variant = "default",
}: ConfirmDialogProps) => {
    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Dialog.Content size="md">
                <Dialog.Header>{title}</Dialog.Header>
                <div className="p-6 space-y-4">
                    {variant === "destructive" && (
                        <div className="flex items-center gap-3 text-destructive">
                            <AlertTriangle className="w-6 h-6" />
                            <p className="font-head font-semibold">WARNING</p>
                        </div>
                    )}
                    <p className="text-foreground">{description}</p>
                </div>
                <Dialog.Footer>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === "destructive" ? "secondary" : "default"}
                        onClick={handleConfirm}
                        className={
                            variant === "destructive"
                                ? "bg-destructive hover:bg-destructive/90 text-white border-destructive"
                                : ""
                        }
                    >
                        {confirmLabel}
                    </Button>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog>
    );
};
