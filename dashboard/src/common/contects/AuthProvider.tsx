import { createContext, useState, useEffect, type ReactNode } from "react";
import { Login } from "@/pages/Login/Login.tsx";
import { postRequest } from "@/common/utils/RequestUtil.ts";

interface AuthContextType {
    isLoggedIn: boolean;
    login: (password: string) => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    isLoggedIn: false,
    login: async () => {},
    logout: () => {},
});

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        const verifyToken = async () => {
            const token = localStorage.getItem("sessionToken");
            if (!token) {
                setIsVerifying(false);
                return;
            }

            try {
                await postRequest("login", { password: token });
                setIsLoggedIn(true);
            } catch (error) {
                console.error("Failed to verify token:", error);
                localStorage.removeItem("sessionToken");
                setIsLoggedIn(false);
            } finally {
                setIsVerifying(false);
            }
        };

        verifyToken();
    }, []);

    const login = async (password: string) => {
        const data = await postRequest("login", { password });
        localStorage.setItem("sessionToken", data.token);
        setIsLoggedIn(true);
    };

    const logout = () => {
        localStorage.removeItem("sessionToken");
        setIsLoggedIn(false);
    };

    if (isVerifying) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-foreground">Verifying session...</div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
            {!isLoggedIn ? <Login /> : children}
        </AuthContext.Provider>
    );
};
