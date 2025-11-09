import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import {Navigation} from "@/common/components/Navigation.tsx";
import {Loader} from "@/common/components/Loader.tsx";


export default () => {
    return (
        <div className="flex flex-col h-screen">
            <Navigation />
            <Suspense fallback={<Loader />}>
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </Suspense>
        </div>
    );
}