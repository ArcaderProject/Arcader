import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";
import { Games } from "@/pages/Games/Games";
import { Lists } from "@/pages/Lists/Lists";
import { ManageListGames } from "@/pages/Lists/ManageListGames";

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
                { path: "/settings", element: <h1>Settings</h1> },
            ],
        },
    ]);

    return <RouterProvider router={router} />;
};

export default App;
