import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";
import { Library } from "@/pages/Library/Library";
import { Lists } from "@/pages/Lists/Lists";
import { Settings } from "@/pages/Settings/Settings";
import { Storage } from "@/pages/Storage/Storage";
import { Debug } from "@/pages/Debug/Debug";

const App = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                { path: "/", element: <Navigate to="/library" /> },
                { path: "/library", element: <Library /> },
                { path: "/games", element: <Navigate to="/library" /> },
                { path: "/lists", element: <Lists /> },
                { path: "/storage", element: <Storage /> },
                { path: "/settings", element: <Settings /> },
                { path: "/debug", element: <Debug /> },
            ],
        },
    ]);

    return <RouterProvider router={router} />;
};

export default App;
