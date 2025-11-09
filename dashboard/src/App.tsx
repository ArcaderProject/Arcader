import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";
import { Games } from "@/pages/Games/Games";

const App = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                { path: "/", element: <Navigate to="/games" /> },
                { path: "/games", element: <Games /> },
                { path: "/settings", element: <h1>Settings</h1> },
            ],
        },
    ]);

    return <RouterProvider router={router} />;
};

export default App;
