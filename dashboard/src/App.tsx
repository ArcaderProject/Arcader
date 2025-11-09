import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import Root from "@/common/layouts/Root.jsx";

const App = () => {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <Root />,
            children: [
                { path: "/", element: <Navigate to="/start" /> },
                { path: "/start", element: <h1>Start</h1> },
            ],
        },
    ]);

    return <RouterProvider router={router}/>;
};

export default App;