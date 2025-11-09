import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import {ThemeProvider} from "@/components/theme-provider"
import {AuthProvider} from "@/common/contects/AuthProvider.tsx";


createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="theme">
            <AuthProvider>
                <App/>
            </AuthProvider>
        </ThemeProvider>
    </StrictMode>,
)
