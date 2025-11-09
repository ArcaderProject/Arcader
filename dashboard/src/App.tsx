import {
    createBrowserRouter,
    Navigate,
    RouterProvider,
} from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";

const App = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                { path: "/", element: <Navigate to="/games" /> },
                { path: "/games", element: <h1>Games</h1> },
                { path: "/settings", element: <h1>Settings</h1> },
            ],
        },
    ]);

    return <RouterProvider router={router} />;
};

export default App;
