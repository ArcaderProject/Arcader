import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
    path: string;
    interactive: boolean;
}

const buildSocketUrl = (path: string): string | null => {
    const token = localStorage.getItem("sessionToken");
    if (!token) return null;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/api/${path}?token=${encodeURIComponent(token)}`;
};

export const TerminalView = ({ path, interactive }: TerminalViewProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const term = new Terminal({
            cursorBlink: interactive,
            disableStdin: !interactive,
            fontFamily: "'JetBrains Mono', 'DejaVu Sans Mono', monospace",
            fontSize: 14,
            theme: {
                background: "#0a0a0a",
                foreground: "#e5e5e5",
                cursor: "#ec5032",
            },
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(container);

        const safeFit = () => {
            try {
                fitAddon.fit();
            } catch {
                return;
            }
        };
        safeFit();

        const url = buildSocketUrl(path);
        if (!url) {
            term.writeln("\x1b[31mNo session token found. Please log in again.\x1b[0m");
            return () => term.dispose();
        }

        const socket = new WebSocket(url);
        socket.binaryType = "arraybuffer";

        const sendResize = () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(
                    JSON.stringify({
                        type: "resize",
                        cols: term.cols,
                        rows: term.rows,
                    }),
                );
            }
        };

        socket.onopen = () => {
            safeFit();
            sendResize();
            if (interactive) term.focus();
        };

        socket.onmessage = (event) => {
            if (typeof event.data === "string") {
                term.write(event.data);
            } else {
                term.write(new Uint8Array(event.data));
            }
        };

        socket.onclose = () => {
            term.writeln("\r\n\x1b[33m[connection closed]\x1b[0m");
        };

        const dataDisposable = interactive
            ? term.onData((data) => {
                  if (socket.readyState === WebSocket.OPEN) {
                      socket.send(new TextEncoder().encode(data));
                  }
              })
            : null;

        const handleResize = () => {
            safeFit();
            sendResize();
        };
        window.addEventListener("resize", handleResize);

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        return () => {
            window.removeEventListener("resize", handleResize);
            resizeObserver.disconnect();
            dataDisposable?.dispose();
            socket.onclose = null;
            socket.close();
            term.dispose();
        };
    }, [path, interactive]);

    return <div ref={containerRef} className="h-full w-full" />;
};
