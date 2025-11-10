import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/common/contexts/AuthProvider.tsx";
import { ConfigProvider } from "@/common/contexts/ConfigProvider.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="theme">
            <AuthProvider>
                <ConfigProvider>
                    <App />
                </ConfigProvider>
            </AuthProvider>
        </ThemeProvider>
    </StrictMode>,
);
