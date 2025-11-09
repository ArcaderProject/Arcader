import { Card } from "@/components/retroui/Card";
import { Button } from "@/components/retroui/Button";
import { GamepadIcon, Upload } from "lucide-react";

interface EmptyStateProps {
    onUpload: () => void;
}

export const EmptyState = ({ onUpload }: EmptyStateProps) => (
    <Card className="p-12 text-center w-full flex flex-col items-center justify-center">
        <GamepadIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-head font-bold mb-2">NO GAMES YET</h2>
        <p className="text-muted-foreground mb-4">
            Upload your first ROM to get started
        </p>
        <Button onClick={onUpload} className="gap-2">
            <Upload className="w-5 h-5" />
            UPLOAD ROM
        </Button>
    </Card>
);
