import {createContext} from "react";
import {Login} from "@/pages/Login/Login.tsx";

export const AuthContext = createContext({});

export const AuthProvider = (children) => {

    const isLoggedIn = false;

    if (!isLoggedIn) {
        return <Login />
    }

    return (
        <AuthContext.Provider value={{}}>
            {children}
        </AuthContext.Provider>
    )
}