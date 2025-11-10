import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";
import { Games } from "@/pages/Games/Games";
import { Lists } from "@/pages/Lists/Lists";
import { ManageListGames } from "@/pages/Lists/ManageListGames";
import { Settings } from "@/pages/Settings/Settings";

const App = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                { path: "/", element: <Navigate to="/games" /> },
                { path: "/games", element: <Games /> },
                { path: "/lists", element: <Lists /> },
                { path: "/lists/:listId/manage", element: <ManageListGames /> },
                { path: "/settings", element: <Settings /> },
            ],
        },
    ]);

    return <RouterProvider router={router} />;
};

export default App;
