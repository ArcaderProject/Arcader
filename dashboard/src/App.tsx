import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";
import { Games } from "@/pages/Games/Games";
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
                { path: "/", element: <Navigate to="/games" /> },
                { path: "/games", element: <Games /> },
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
