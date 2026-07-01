import { useState } from "react";
import { Button } from "@/components/retroui/Button";
import { TerminalView } from "./components/TerminalView";

type View = "terminal" | "logs";

export const Debug = () => {
    const [view, setView] = useState<View>("terminal");

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
            <div className="flex gap-2 mb-4">
                <Button
                    variant={view === "terminal" ? "default" : "secondary"}
                    size="sm"
                    className="uppercase font-bold"
                    onClick={() => setView("terminal")}
                >
                    Terminal
                </Button>
                <Button
                    variant={view === "logs" ? "default" : "secondary"}
                    size="sm"
                    className="uppercase font-bold"
                    onClick={() => setView("logs")}
                >
                    Logs
                </Button>
            </div>

            <div className="flex-1 min-h-0 border-2 border-border rounded bg-[#0a0a0a] overflow-hidden p-2">
                {view === "terminal" ? (
                    <TerminalView path="terminal/ws" interactive={true} />
                ) : (
                    <TerminalView path="terminal/logs" interactive={false} />
                )}
            </div>
        </div>
    );
};
