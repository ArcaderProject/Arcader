import express from "express";
import healthRouter from "./routes/healthRouter.js";
import gamesRouter from "./routes/gamesRouter.js";
import gameListsRouter from "./routes/gameListsRouter.js";
import configRouter from "./routes/configRouter.js";
import saveFoldersRouter from "./routes/saveFoldersRouter.js";
import { getConfig } from "../utils/configUtils.js";

const app = express();
const SERVER_PORT = 5328;

const ignoreCORS = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
};

const authenticateRequest = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const currentPassword = getConfig('admin.password');
    
    if (!authHeader || authHeader !== `Bearer ${currentPassword}`) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
};

app.use(express.json());
app.use(ignoreCORS);

const apiRouter = express.Router();

apiRouter.post("/login", (req, res) => {
    const currentPassword = getConfig('admin.password');
    
    if (req.body?.password === currentPassword) {
        res.json({ token: currentPassword });
    } else {
        res.status(401).json({ error: "Invalid password" });
    }
});

apiRouter.use("/health", authenticateRequest, healthRouter);
apiRouter.use("/games", authenticateRequest, gamesRouter);
apiRouter.use("/lists", authenticateRequest, gameListsRouter);
apiRouter.use("/config", authenticateRequest, configRouter);
apiRouter.use("/save-folders", authenticateRequest, saveFoldersRouter);

app.use("/api", apiRouter);

app.get("/", (req, res) => {
    res.send("admin ui");
});

export const startServer = () => {
    app.listen(SERVER_PORT, () => {
        console.log(`Server started on port ${SERVER_PORT}`);
    });
};
