import { useRef } from "react";
import { Dialog } from "@/components/retroui/Dialog";
import { Button } from "@/components/retroui/Button";
import { Image as ImageIcon } from "lucide-react";

interface CoverDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpload: (file: File) => void;
    isDragging: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
}

export const CoverDialog = ({
    open,
    onOpenChange,
    onUpload,
    isDragging,
    onDragStart,
    onDragEnd,
}: CoverDialogProps) => {
    const coverInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(file);
            if (coverInputRef.current) coverInputRef.current.value = "";
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        onDragEnd();
        const file = e.dataTransfer.files[0];
        if (file) {
            onUpload(file);
            if (coverInputRef.current) coverInputRef.current.value = "";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Dialog.Content size="md">
                <Dialog.Header>UPLOAD COVER ART</Dialog.Header>
                <div className="p-6 space-y-4">
                    <div
                        className={`border-4 border-dashed rounded-lg p-8 text-center transition-colors ${
                            isDragging ? "border-primary bg-primary/10" : "border-muted"
                        }`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            onDragStart();
                        }}
                        onDragLeave={onDragEnd}
                        onDrop={handleDrop}
                    >
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-head mb-2">
                            {isDragging ? "DROP IMAGE HERE" : "SELECT COVER IMAGE"}
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                            {isDragging ? "Release to upload" : "Drag and drop or click to browse"}
                        </p>
                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="cover-upload"
                        />
                        <Button variant="secondary" onClick={() => coverInputRef.current?.click()}>
                            CHOOSE FILE
                        </Button>
                    </div>
                </div>
            </Dialog.Content>
        </Dialog>
    );
};
