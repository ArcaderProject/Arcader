import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import {Sidebar} from "@/common/components/Sidebar.tsx";
import {Loader} from "@/common/components/Loader.tsx";


export default () => {
    return (
        <div className="flex h-screen">
            <Suspense fallback={<Loader />}>
                <Sidebar />
                <Outlet />
            </Suspense>
        </div>
    );
}