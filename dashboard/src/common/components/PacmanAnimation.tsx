import { useEffect, useRef } from "react";

interface PacmanAnimationProps {
    isActive: boolean;
    onComplete: () => void;
}

export const PacmanAnimation = ({
    isActive,
    onComplete,
}: PacmanAnimationProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isActive || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const pixelScale = 3;
        const pixelWidth = canvas.width / pixelScale;
        const pixelHeight = canvas.height / pixelScale;
        const dotCount = 8;
        const dotSpacing = pixelWidth / (dotCount + 2);
        const pacmanSize = 6;
        let position = -pacmanSize * 2;
        let frameCount = 0;
        const eaten: number[] = [];

        const sprites = {
            0: [
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
                [0, 1, 1, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0],
                [1, 1, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            ],
            1: [
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0],
                [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            ],
            2: [
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            ],
            3: [
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0],
                [1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
                [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            ],
        };

        const animate = () => {
            const pixelCanvas = document.createElement("canvas");
            pixelCanvas.width = pixelWidth;
            pixelCanvas.height = pixelHeight;
            const pixelCtx = pixelCanvas.getContext("2d");
            if (!pixelCtx) return;

            pixelCtx.imageSmoothingEnabled = false;
            pixelCtx.clearRect(0, 0, pixelWidth, pixelHeight);

            for (let i = 0; i < dotCount; i++) {
                if (!eaten.includes(i)) {
                    const dotX = Math.floor(dotSpacing * (i + 2));
                    const dotY = Math.floor(pixelHeight / 2);

                    if (position + pacmanSize >= dotX - 1) {
                        eaten.push(i);
                    } else {
                        pixelCtx.fillStyle = "#FFB897";
                        pixelCtx.fillRect(dotX - 1, dotY - 1, 2, 2);
                    }
                }
            }

            const animFrame = Math.floor(frameCount / 4) % 4;
            frameCount++;
            const pacmanX = Math.floor(position);
            const pacmanY = Math.floor(pixelHeight / 2) - 6;
            const sprite = sprites[animFrame as keyof typeof sprites];

            for (let row = 0; row < 13; row++) {
                for (let col = 0; col < 13; col++) {
                    const pixel = sprite[row][col];
                    if (pixel === 1) {
                        pixelCtx.fillStyle = "#FF2C00";
                        pixelCtx.fillRect(pacmanX + col, pacmanY + row, 1, 1);
                    } else if (pixel === 2) {
                        pixelCtx.fillStyle = "#000000";
                        pixelCtx.fillRect(pacmanX + col, pacmanY + row, 1, 1);
                    }
                }
            }

            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
                pixelCanvas,
                0,
                0,
                pixelWidth,
                pixelHeight,
                0,
                0,
                canvas.width,
                canvas.height,
            );

            position += 1.2;

            if (position > pixelWidth + pacmanSize * 2) {
                onComplete();
                return;
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isActive, onComplete]);

    return (
        <canvas
            ref={canvasRef}
            width={200}
            height={40}
            className="absolute top-0 left-0 w-[200px] h-10"
        />
    );
};
